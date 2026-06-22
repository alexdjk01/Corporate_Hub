from sqlalchemy.orm import Session

from app.models.db_models import Conversation


def get_or_create_conversation(
    db: Session,
    user_id: int,
    conversation_id: int | None = None,
    title_seed: str | None = None,
) -> Conversation:
    if conversation_id is not None:
        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
            )
            .first()
        )

        if conversation:
            return conversation

    title = None
    if title_seed:
        title = title_seed.strip()[:60]

    conversation = Conversation(
        user_id=user_id,
        title=title,
        summary=None,
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation