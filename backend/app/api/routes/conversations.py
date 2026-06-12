from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.models.db_models import Conversation, Message
from app.models.user_models import User

router = APIRouter()

class RenameConversationRequest(BaseModel):
    title: str

@router.get("/conversations")
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
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
def get_latest_conversation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
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
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.patch("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: int,
    req: RenameConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    conv.title = title[:255]
    db.commit()
    db.refresh(conv)

    return {
        "id": conv.id,
        "title": conv.title,
        "success": True,
    }

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )

    if not conv:
        return {"success": False, "message": "Conversation not found"}

    db.delete(conv)
    db.commit()

    return {"success": True}