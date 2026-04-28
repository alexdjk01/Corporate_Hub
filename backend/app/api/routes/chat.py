from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import requests

from app.api.deps import get_db, get_current_user
from app.models.db_models import Conversation, Message
from app.models.user_models import User
from app.schemas.chat import ChatRequest
from app.services.rag_service import retrieve_relevant_chunks
from app.services.image_service import create_generated_image
from app.core.config import OLLAMA_CHAT_URL, OLLAMA_CHAT_MODEL

router = APIRouter()


def is_image_generation_request(message: str) -> bool:
    text = (message or "").strip().lower()

    triggers = [
        "generate me an image",
        "generate an image",
        "create an image",
        "make an image",
        "give me an image",
        "give me a picture",
        "show me an image",
        "show me a picture",
        "generate a picture",
        "create a picture",
        "make a picture",
        "generate image of",
        "generate picture of",
        "create image of",
        "create picture of",
    ]

    return any(trigger in text for trigger in triggers)


def extract_image_prompt(message: str) -> str:
    text = (message or "").strip()
    lowered = text.lower()

    prefixes = [
        "generate me an image of ",
        "generate an image of ",
        "create an image of ",
        "make an image of ",
        "give me an image of ",
        "show me an image of ",
        "generate a picture of ",
        "create a picture of ",
        "make a picture of ",
        "give me a picture of ",
        "show me a picture of ",
        "generate image of ",
        "generate picture of ",
        "create image of ",
        "create picture of ",
        "generate me an image for ",
        "generate an image for ",
        "create an image for ",
        "make an image for ",
    ]

    for prefix in prefixes:
        if lowered.startswith(prefix):
            result = text[len(prefix):].strip(" .,:;!-")
            if result:
                return result

    return text


@router.post("/chat")
def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation_id = req.conversation_id

    if conversation_id is None:
        conv = Conversation(title=None, summary=None, user_id=current_user.id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conversation_id = conv.id
    else:
        conv = (
            db.query(Conversation)
            .filter(
                Conversation.id == conversation_id,
                Conversation.user_id == current_user.id,
            )
            .first()
        )
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=req.message,
    )
    db.add(user_message)
    db.commit()

    conv = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if conv and not conv.title:
        clean_title = req.message.strip()
        conv.title = clean_title[:60] if clean_title else f"Chat {conversation_id}"
        db.commit()

    history = (
        db.query(Message)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .filter(
            Message.conversation_id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .order_by(Message.id.asc())
        .all()
    )

    image_request = is_image_generation_request(req.message)

    system_parts = [
        "You are a concise assistant inside a corporate AI hub.",
        "Use previous messages as context.",
        "If the user asks a follow-up question, keep the current topic.",
        "Answer briefly and clearly.",
        "Use markdown bullets when useful.",
        "Do not change topic unless the user clearly changes topic.",
    ]

    rag_sources = []

    if req.use_rag and not image_request:
        retrieved = retrieve_relevant_chunks(req.message, user_id=current_user.id, top_k=6)
        rag_context = retrieved["context"]
        rag_sources = retrieved["sources"]

        if rag_context.strip():
            system_parts.append(
                "The user has enabled knowledge-base mode. "
                "Use the retrieved document context below when it is relevant."
            )
            system_parts.append(f"Retrieved document context:\n{rag_context}")
        else:
            system_parts.append(
                "The user enabled knowledge-base mode, but no relevant document context was found."
            )

    ollama_messages = [
        {
            "role": "system",
            "content": "\n\n".join(system_parts),
        }
    ]

    for msg in history:
        ollama_messages.append(
            {
                "role": msg.role,
                "content": msg.content,
            }
        )

    def generate():
        if image_request:
            image_prompt = extract_image_prompt(req.message)

            try:
                yield "Generating image...\n\n"

                image = create_generated_image(
                    db=db,
                    user_id=current_user.id,
                    prompt=image_prompt,
                    negative_prompt="",
                    width=1024,
                    height=1024,
                )

                assistant_text = (
                    f"Generated image for: {image_prompt}\n\n"
                    f"[[generated_image:{image.id}]]"
                )

                assistant_message = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=assistant_text,
                )
                db.add(assistant_message)
                db.commit()

                yield assistant_text
                return

            except Exception as e:
                error_text = f"Error generating image: {str(e)}"

                assistant_message = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content=error_text,
                )
                db.add(assistant_message)
                db.commit()

                yield error_text
                return

        full_response = ""

        try:
            with requests.post(
                OLLAMA_CHAT_URL,
                json={
                    "model": OLLAMA_CHAT_MODEL,
                    "messages": ollama_messages,
                    "stream": True,
                    "options": {"temperature": 0.2},
                },
                stream=True,
                timeout=120,
            ) as response:
                response.raise_for_status()

                for line in response.iter_lines():
                    if not line:
                        continue

                    data = json.loads(line.decode("utf-8"))
                    chunk = data.get("message", {}).get("content", "")

                    if chunk:
                        full_response += chunk
                        yield chunk

            assistant_text = full_response.strip() or "I could not generate a response."

            if req.use_rag and rag_sources:
                unique_files = []
                seen = set()

                for source in rag_sources:
                    file_name = source.get("file_name")
                    if file_name and file_name not in seen:
                        seen.add(file_name)
                        unique_files.append(file_name)

                if unique_files:
                    assistant_text += "\n\n**Sources:**\n"
                    for file_name in unique_files:
                        assistant_text += f"- {file_name}\n"

            assistant_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=assistant_text,
            )
            db.add(assistant_message)
            db.commit()

        except Exception as e:
            error_text = f"Error: {str(e)}"

            assistant_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=error_text,
            )
            db.add(assistant_message)
            db.commit()

            yield error_text

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={"X-Conversation-Id": str(conversation_id)},
    )