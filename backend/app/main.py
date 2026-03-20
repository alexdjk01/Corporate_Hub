from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, text
from sqlalchemy.orm import Session
from app.core.db import SessionLocal, Base, engine
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(
        TIMESTAMP,
        server_default=text("CURRENT_TIMESTAMP"),
        server_onupdate=text("CURRENT_TIMESTAMP"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/services")
def services_health():
    try:
        r = requests.get("http://localhost:11434", timeout=2)
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False

    return {
        "ollama": ollama_ok,
        "tts": False,
        "stt": False,
    }


@app.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    conversation_id = req.conversation_id

    if conversation_id is None:
        conv = Conversation(title=None, summary=None)
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conversation_id = conv.id

    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=req.message,
    )
    db.add(user_message)
    db.commit()

    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv and not conv.title:
        clean_title = req.message.strip()
        conv.title = clean_title[:60] if clean_title else f"Chat {conversation_id}"
        db.commit()

    history = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.asc())
        .all()
    )

    ollama_messages = [
        {
            "role": "system",
            "content": (
                "You are a concise assistant inside a corporate AI hub. "
                "Use previous messages as context. "
                "If the user asks a follow-up question, keep the current topic. "
                "Answer briefly and clearly. "
                "Use markdown bullets when useful. "
                "Do not change topic unless the user clearly changes topic."
            ),
        }
    ]

    for msg in history:
        ollama_messages.append(
            {
                "role": msg.role,
                "content": msg.content,
            }
        )

    try:
        response = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": "gemma3:4b",
                "messages": ollama_messages,
                "stream": False,
                "options": {
                    "temperature": 0.2
                },
            },
            timeout=120,
        )
        response.raise_for_status()

        data = response.json()
        assistant_text = data.get("message", {}).get("content", "").strip()

        if not assistant_text:
            assistant_text = "I could not generate a response."

        assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_text,
        )
        db.add(assistant_message)
        db.commit()

        return {
            "conversation_id": conversation_id,
            "response": assistant_text,
        }

    except Exception as e:
        error_text = f"Error: {str(e)}"

        assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=error_text,
        )
        db.add(assistant_message)
        db.commit()

        return {
            "conversation_id": conversation_id,
            "response": error_text,
        }


@app.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: int, db: Session = Depends(get_db)):
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.asc())
        .all()
    )

    return [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "created_at": str(msg.created_at),
        }
        for msg in messages
    ]

@app.get("/conversations")
def get_conversations(db: Session = Depends(get_db)):
    conversations = (
        db.query(Conversation)
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
        .all()
    )

    return [
        {
            "id": conv.id,
            "title": conv.title or f"Chat {conv.id}",
            "created_at": str(conv.created_at),
            "updated_at": str(conv.updated_at),
        }
        for conv in conversations
    ]


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()

    if not conv:
        return {"error": "Conversation not found"}

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.asc())
        .all()
    )

    return {
        "id": conv.id,
        "title": conv.title or f"Chat {conv.id}",
        "messages": [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "created_at": str(msg.created_at),
            }
            for msg in messages
        ],
    }

@app.get("/conversations/latest")
def get_latest_conversation(db: Session = Depends(get_db)):
    conv = (
        db.query(Conversation)
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
        .first()
    )

    if not conv:
        return None

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.id.asc())
        .all()
    )

    return {
        "id": conv.id,
        "title": conv.title or f"Chat {conv.id}",
        "messages": [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "created_at": str(msg.created_at),
            }
            for msg in messages
        ],
    }


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()

    if not conv:
        return {"success": False, "message": "Conversation not found"}

    db.delete(conv)
    db.commit()

    return {"success": True}