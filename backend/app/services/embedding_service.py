import requests

OLLAMA_EMBED_URL = "http://localhost:11434/api/embed"
EMBED_MODEL = "embeddinggemma"


def get_embedding(text: str) -> list[float]:
    response = requests.post(
        OLLAMA_EMBED_URL,
        json={
            "model": EMBED_MODEL,
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
            "model": EMBED_MODEL,
            "input": texts,
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return data["embeddings"]