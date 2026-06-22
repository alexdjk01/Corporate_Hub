import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:root@localhost/corporate_hub"
)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "12"))

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_CHAT_URL = os.getenv("OLLAMA_CHAT_URL", f"{OLLAMA_BASE_URL}/api/chat")
OLLAMA_EMBED_URL = os.getenv("OLLAMA_EMBED_URL", f"{OLLAMA_BASE_URL}/api/embed")
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "gemma3:4b")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma")

COMFYUI_BASE_URL = os.getenv("COMFYUI_BASE_URL", "http://localhost:8188")
COMFYUI_CHECKPOINT = os.getenv(
    "COMFYUI_CHECKPOINT",
   # "v1-5-pruned-emaonly-fp16.safetensors"
    # "sd_xl_base_1.0.safetensors"
    "juggernautXL_ragnarok.safetensors"
    # "Flux1-Dev-SRPO-v1-fp8.safetensors"
    # "juggernautXL_versionXInpaint.safetensors"
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
TEMP_UPLOAD_DIR = os.getenv("TEMP_UPLOAD_DIR", "temp_uploads")
AUDIO_OUTPUT_DIR = os.getenv("AUDIO_OUTPUT_DIR", "generated_audio")
IMAGE_OUTPUT_DIR = os.getenv("IMAGE_OUTPUT_DIR", "generated_images")
CHROMA_PATH = os.getenv("CHROMA_PATH", "chroma_db")