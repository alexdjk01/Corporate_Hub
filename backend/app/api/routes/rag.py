from fastapi import APIRouter, UploadFile, File, Form, Depends
import os
import uuid

from app.api.deps import get_current_user
from app.models.user_models import User
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
    current_user: User = Depends(get_current_user),
):
    allowed = (".txt", ".pdf")

    if not file.filename.lower().endswith(allowed):
        return {"error": "Only .txt and .pdf files are supported for now"}

    saved_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, saved_name)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        return index_document(
            file_path=file_path,
            original_name=file.filename,
            user_id=current_user.id,
        )
    except Exception as e:
        return {"error": str(e)}


@router.post("/rag/query")
async def rag_query(
    question: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    return query_documents(question, user_id=current_user.id)


@router.get("/rag/documents")
def rag_documents(current_user: User = Depends(get_current_user)):
    return list_documents(user_id=current_user.id)


@router.delete("/rag/documents/{document_id}")
def rag_delete(
    document_id: str,
    current_user: User = Depends(get_current_user),
):
    delete_document(document_id, user_id=current_user.id)
    return {"success": True}