import requests


OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "gemma3:4b"


def generate_chat_response(history: list[dict]) -> str:
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": OLLAMA_MODEL,
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