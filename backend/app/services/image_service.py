from sqlalchemy.orm import Session

from app.models.db_models import GeneratedImage
from app.services.comfyui_service import generate_image
from app.storage.file_storage import save_bytes_to_user_file, delete_file_if_exists
from app.core.config import IMAGE_OUTPUT_DIR


def create_generated_image(
    db: Session,
    user_id: int,
    prompt: str,
    negative_prompt: str = "",
    width: int = 1024,
    height: int = 768,
) -> GeneratedImage:
    result = generate_image(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
    )

    file_name, file_path = save_bytes_to_user_file(
        base_dir=IMAGE_OUTPUT_DIR,
        user_id=user_id,
        content=result["bytes"],
        extension=".png",
    )

    image = GeneratedImage(
        user_id=user_id,
        prompt=prompt.strip(),
        negative_prompt=negative_prompt.strip() or None,
        image_type="ai",
        file_name=file_name,
        file_path=file_path,
        width=result["width"],
        height=result["height"],
        seed=result["seed"],
        model_name=result["model_name"],
        status="completed",
    )
    db.add(image)
    db.commit()
    db.refresh(image)

    return image


def list_generated_images(db: Session, user_id: int) -> list[GeneratedImage]:
    return (
        db.query(GeneratedImage)
        .filter(GeneratedImage.user_id == user_id)
        .order_by(GeneratedImage.id.desc())
        .all()
    )


def get_generated_image(db: Session, image_id: int, user_id: int) -> GeneratedImage | None:
    return (
        db.query(GeneratedImage)
        .filter(
            GeneratedImage.id == image_id,
            GeneratedImage.user_id == user_id,
        )
        .first()
    )


def delete_generated_image(db: Session, image: GeneratedImage) -> None:
    delete_file_if_exists(image.file_path)
    db.delete(image)
    db.commit()