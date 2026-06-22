from fastapi import APIRouter, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session
import os
import uuid

from app.api.deps import get_current_user, get_db
from app.models.user_models import User
from app.models.db_models import Message
from app.services.conversation_service import get_or_create_conversation
from app.services.rag_service import (
    index_document,
    query_documents,
    list_documents,
    delete_document,
)

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/rag/upload")
async def rag_upload(
    file: UploadFile = File(...),
    scope: str = Form("global"),
    conversation_id: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = (".txt", ".pdf")

    if not file.filename.lower().endswith(allowed):
        return {"error": "Only .txt and .pdf files are supported for now"}

    scope = scope.lower().strip()

    if scope not in ("global", "conversation"):
        return {"error": "Invalid document scope"}

    parsed_conversation_id = None

    if conversation_id and conversation_id not in ("null", "undefined"):
        try:
            parsed_conversation_id = int(conversation_id)
        except ValueError:
            return {"error": "Invalid conversation_id"}

    final_conversation_id = -1

    if scope == "conversation":
        conversation = get_or_create_conversation(
            db=db,
            user_id=current_user.id,
            conversation_id=parsed_conversation_id,
            title_seed=file.filename,
        )
        final_conversation_id = conversation.id

    saved_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, saved_name)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        result = index_document(
            file_path=file_path,
            original_name=file.filename,
            user_id=current_user.id,
            scope=scope,
            conversation_id=final_conversation_id,
        )

        if scope == "conversation":
            upload_message = Message(
                conversation_id=final_conversation_id,
                role="assistant",
                content=f"Document uploaded: {file.filename}",
            )
            db.add(upload_message)
            db.commit()

        result["scope"] = scope
        result["conversation_id"] = (
            final_conversation_id if scope == "conversation" else None
        )

        return result

    except Exception as e:
        return {
            "error": str(e),
            "scope": scope,
            "conversation_id": (
                final_conversation_id if scope == "conversation" else None
            ),
        }


@router.post("/rag/query")
async def rag_query(
    question: str = Form(...),
    scope: str = Form("global"),
    conversation_id: int | None = Form(None),
    current_user: User = Depends(get_current_user),
):
    scope = scope.lower().strip()

    if scope == "conversation":
        if conversation_id is None:
            return {
                "answer": "No conversation was selected for document search.",
                "sources": [],
            }

        return query_documents(
            question=question,
            user_id=current_user.id,
            scope="conversation",
            conversation_id=conversation_id,
        )

    return query_documents(
        question=question,
        user_id=current_user.id,
        scope="global",
        conversation_id=-1,
    )


@router.get("/rag/documents")
def rag_documents(
    scope: str = "global",
    conversation_id: int | None = None,
    current_user: User = Depends(get_current_user),
):
    scope = scope.lower().strip()

    if scope == "conversation":
        if conversation_id is None:
            return []

        return list_documents(
            user_id=current_user.id,
            scope="conversation",
            conversation_id=conversation_id,
        )

    return list_documents(
        user_id=current_user.id,
        scope="global",
        conversation_id=-1,
    )


@router.delete("/rag/documents/{document_id}")
def rag_delete(
    document_id: str,
    scope: str = "global",
    conversation_id: int | None = None,
    current_user: User = Depends(get_current_user),
):
    scope = scope.lower().strip()

    if scope == "conversation":
        if conversation_id is None:
            return {"error": "conversation_id is required"}

        delete_document(
            document_id=document_id,
            user_id=current_user.id,
            scope="conversation",
            conversation_id=conversation_id,
        )
    else:
        delete_document(
            document_id=document_id,
            user_id=current_user.id,
            scope="global",
            conversation_id=-1,
        )

    return {"success": True}