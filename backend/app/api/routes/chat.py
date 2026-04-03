from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import requests

from app.api.deps import get_db, get_current_user
from app.models.db_models import Conversation, Message
from app.models.user_models import User
from app.schemas.chat import ChatRequest

router = APIRouter()

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "gemma3:4b"


@router.post("/chat")
def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation_id = req.conversation_id

    if conversation_id is None:
        conv = Conversation(title=None, summary=None, user_id=current_user.id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conversation_id = conv.id
    else:
        conv = (
            db.query(Conversation)
            .filter(
                Conversation.id == conversation_id,
                Conversation.user_id == current_user.id,
            )
            .first()
        )
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=req.message,
    )
    db.add(user_message)
    db.commit()

    conv = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if conv and not conv.title:
        clean_title = req.message.strip()
        conv.title = clean_title[:60] if clean_title else f"Chat {conversation_id}"
        db.commit()

    history = (
        db.query(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .filter(
            Message.conversation_id == conversation_id,
            Conversation.user_id == current_user.id,
        )
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

    def generate():
        full_response = ""

        try:
            with requests.post(
                OLLAMA_URL,
                json={
                    "model": OLLAMA_MODEL,
                    "messages": ollama_messages,
                    "stream": True,
                    "options": {"temperature": 0.2},
                },
                stream=True,
                timeout=120,
            ) as response:
                response.raise_for_status()

                for line in response.iter_lines():
                    if not line:
                        continue

                    data = json.loads(line.decode("utf-8"))
                    chunk = data.get("message", {}).get("content", "")

                    if chunk:
                        full_response += chunk
                        yield chunk

            assistant_text = full_response.strip() or "I could not generate a response."

            assistant_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=assistant_text,
            )
            db.add(assistant_message)
            db.commit()

        except Exception as e:
            error_text = f"Error: {str(e)}"

            assistant_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=error_text,
            )
            db.add(assistant_message)
            db.commit()

            yield error_text

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={"X-Conversation-Id": str(conversation_id)},
    )