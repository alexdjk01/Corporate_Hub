from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests

from app.core.db import Base, engine
from app.api.routes.chat import router as chat_router
from app.api.routes.conversations import router as conversations_router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/services")
def services_health():
    try:
        r = requests.get("http://localhost:11434", timeout=2)
        ollama_ok = r.status_code == 200
    except Exception:
        ollama_ok = False

    return {
        "ollama": ollama_ok,
        "tts": False,
        "stt": False,
    }


app.include_router(chat_router)
app.include_router(conversations_router)