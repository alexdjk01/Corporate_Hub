import requests

from app.core.config import OLLAMA_EMBED_URL, OLLAMA_EMBED_MODEL


def get_embedding(text: str) -> list[float]:
    response = requests.post(
        OLLAMA_EMBED_URL,
        json={
            "model": OLLAMA_EMBED_MODEL,
            "input": text,
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return data["embeddings"][0]


def get_embeddings(texts: list[str]) -> list[list[float]]:
    response = requests.post(
        OLLAMA_EMBED_URL,
        json={
            "model": OLLAMA_EMBED_MODEL,
            "input": texts,
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return data["embeddings"]