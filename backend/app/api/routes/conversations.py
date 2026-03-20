from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.db_models import Conversation, Message

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/conversations")
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


@router.get("/conversations/latest")
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


@router.get("/conversations/{conversation_id}")
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


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()

    if not conv:
        return {"success": False, "message": "Conversation not found"}

    db.delete(conv)
    db.commit()

    return {"success": True}