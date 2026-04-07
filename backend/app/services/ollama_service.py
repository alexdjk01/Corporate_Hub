import requests

from app.core.config import OLLAMA_CHAT_URL, OLLAMA_CHAT_MODEL


def generate_chat_response(history: list[dict]) -> str:
    response = requests.post(
        OLLAMA_CHAT_URL,
        json={
            "model": OLLAMA_CHAT_MODEL,
            "messages": history,
            "stream": False,
            "options": {
                "temperature": 0.2
            },
        },
        timeout=120,
    )
    response.raise_for_status()

    data = response.json()
    content = data.get("message", {}).get("content", "").strip()

    if not content:
        return "I could not generate a response."

    return content