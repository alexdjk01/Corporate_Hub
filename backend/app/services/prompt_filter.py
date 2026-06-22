import re


BLOCKED_PATTERNS = [
    r"\bnude\b",
    r"\bnaked\b",
    r"\bexplicit\b",
    r"\bporn\b",
    r"\bpornographic\b",
    r"\bsex\b",
    r"\bsexual\b",
    r"\berotic\b",
    r"\bhentai\b",
    r"\bnsfw\b",
    r"\bxxx\b",
    r"\bbreasts?\b",
    r"\bgenitals?\b",
    r"\bunderage\b",
    r"\bchild sexual\b",
    r"\bminor\b.*\bsexual\b",
    r"\bviolence\b",
    r"\bgore\b",
    r"\bbloodbath\b",
    r"\bmurder\b",
    r"\bsuicide\b",
    r"\bself[- ]harm\b",
    r"\bterrorist\b",
    r"\bbomb\b",
    r"\bweapon\b",
    r"\bkill\b",
    r"\bracist\b",
    r"\bhate speech\b",
]


SAFE_ERROR_MESSAGE = (
    "This image request is not allowed because it may contain explicit, "
    "violent, hateful, or unsafe content. Please try a different prompt."
)


def validate_image_prompt(prompt: str, negative_prompt: str = "") -> None:
    combined_text = f"{prompt or ''} {negative_prompt or ''}".lower()

    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, combined_text):
            raise ValueError(SAFE_ERROR_MESSAGE)