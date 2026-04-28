from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os

from app.api.deps import get_db, get_current_user
from app.models.user_models import User
from app.schemas.images import GeneratedImageResponse
from app.services.image_service import (
    create_generated_image,
    list_generated_images,
    get_generated_image,
    delete_generated_image,
    regenerate_generated_image,
)

router = APIRouter()


@router.post("/images/generate")
def generate_user_image(
    prompt: str = Form(...),
    negative_prompt: str = Form(""),
    width: int = Form(1024),
    height: int = Form(1024),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        image = create_generated_image(
            db=db,
            user_id=current_user.id,
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "id": image.id,
        "prompt": image.prompt,
        "image_type": image.image_type,
        "width": image.width,
        "height": image.height,
        "seed": image.seed,
        "model_name": image.model_name,
        "status": image.status,
        "error_message": image.error_message,
        "created_at": str(image.created_at),
    }


@router.post("/images/{image_id}/regenerate")
def regenerate_user_image(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    original_image = get_generated_image(db=db, image_id=image_id, user_id=current_user.id)

    if not original_image:
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        image = regenerate_generated_image(db=db, image=original_image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "id": image.id,
        "prompt": image.prompt,
        "image_type": image.image_type,
        "width": image.width,
        "height": image.height,
        "seed": image.seed,
        "model_name": image.model_name,
        "status": image.status,
        "error_message": image.error_message,
        "created_at": str(image.created_at),
    }


@router.get("/images", response_model=list[GeneratedImageResponse])
def get_user_images(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    images = list_generated_images(db=db, user_id=current_user.id)

    return [
        {
            "id": image.id,
            "prompt": image.prompt,
            "image_type": image.image_type,
            "width": image.width,
            "height": image.height,
            "seed": image.seed,
            "model_name": image.model_name,
            "status": image.status,
            "error_message": image.error_message,
            "created_at": str(image.created_at),
        }
        for image in images
    ]


@router.get("/images/{image_id}/file")
def get_user_image_file(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    image = get_generated_image(db=db, image_id=image_id, user_id=current_user.id)

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    if image.status != "completed":
        raise HTTPException(status_code=400, detail="Image is not completed yet")

    if not image.file_path or not os.path.exists(image.file_path):
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(
        image.file_path,
        media_type="image/png",
        filename=image.file_name,
    )


@router.delete("/images/{image_id}")
def delete_user_image(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    image = get_generated_image(db=db, image_id=image_id, user_id=current_user.id)

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    delete_generated_image(db=db, image=image)
    return {"success": True}