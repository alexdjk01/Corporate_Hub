from pydantic import BaseModel


class GeneratedImageResponse(BaseModel):
    id: int
    prompt: str
    image_type: str
    width: int
    height: int
    seed: str | None = None
    model_name: str | None = None
    status: str
    error_message: str | None = None
    created_at: str


class GenerateImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024