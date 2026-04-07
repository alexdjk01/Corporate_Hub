import os
import uuid


def ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def ensure_user_dir(base_dir: str, user_id: int) -> str:
    user_dir = os.path.join(base_dir, str(user_id))
    os.makedirs(user_dir, exist_ok=True)
    return user_dir


def build_unique_file_name(extension: str) -> str:
    clean_ext = extension if extension.startswith(".") else f".{extension}"
    return f"{uuid.uuid4()}{clean_ext}"


def save_bytes_to_user_file(
    base_dir: str,
    user_id: int,
    content: bytes,
    extension: str,
) -> tuple[str, str]:
    user_dir = ensure_user_dir(base_dir, user_id)
    file_name = build_unique_file_name(extension)
    file_path = os.path.join(user_dir, file_name)

    with open(file_path, "wb") as f:
        f.write(content)

    return file_name, file_path


def delete_file_if_exists(file_path: str) -> None:
    if file_path and os.path.exists(file_path):
        os.remove(file_path)