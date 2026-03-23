import os
import uuid
import re
import numpy as np
import soundfile as sf
from kokoro import KPipeline

AUDIO_OUTPUT_DIR = "generated_audio"
os.makedirs(AUDIO_OUTPUT_DIR, exist_ok=True)

pipeline = KPipeline(lang_code="a")


def clean_text_for_tts(text: str) -> str:
    text = text.strip()

    # Remove markdown formatting
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"`(.*?)`", r"\1", text)
    text = re.sub(r"#+\s*", "", text)

    # Convert bullet points into sentence pauses
    text = re.sub(r"^\s*[-•]\s+", ". ", text, flags=re.MULTILINE)

    # Headings like "Weather:" -> "Weather."
    text = re.sub(r"([A-Za-z0-9])\s*:\s*", r"\1. ", text)

    # Semicolons become softer sentence pauses
    text = re.sub(r"\s*;\s*", ". ", text)

    # Keep commas as commas for natural short pauses
    # But normalize spaces around them
    text = re.sub(r"\s*,\s*", ", ", text)

    # Replace line breaks with sentence pauses
    text = re.sub(r"\n+", ". ", text)

    # Remove weird extra symbols that sound bad when spoken
    text = re.sub(r"[\[\]\{\}\*_#<>|\\]", " ", text)

    # Collapse repeated punctuation
    text = re.sub(r"\.{2,}", ".", text)
    text = re.sub(r",{2,}", ",", text)

    # Fix spacing
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([.,!?])", r"\1", text)

    return text.strip()


def split_text_for_tts(text: str, max_chars: int = 220) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    current = ""

    for sentence in sentences:
        if not sentence.strip():
            continue

        if len(current) + len(sentence) + 1 <= max_chars:
            current = f"{current} {sentence}".strip()
        else:
            if current:
                chunks.append(current)
            current = sentence.strip()

    if current:
        chunks.append(current)

    return chunks


def synthesize_speech(text: str, voice: str = "af_sarah") -> str:
    file_name = f"{uuid.uuid4()}.wav"
    file_path = os.path.join(AUDIO_OUTPUT_DIR, file_name)

    cleaned_text = clean_text_for_tts(text)

    if not cleaned_text:
        raise ValueError("Text is empty after cleaning")

    text_chunks = split_text_for_tts(cleaned_text)

    if not text_chunks:
        raise ValueError("No valid text chunks for TTS")

    audio_chunks = []

    for chunk_text in text_chunks:
        generator = pipeline(chunk_text, voice=voice)

        for _, _, audio in generator:
            audio_chunks.append(audio)

        # Add a small silence between chunks for more natural pacing
        silence = np.zeros(int(24000 * 0.18), dtype=np.float32)
        audio_chunks.append(silence)

    if not audio_chunks:
        raise ValueError("No audio generated")

    full_audio = np.concatenate(audio_chunks)
    sf.write(file_path, full_audio, 24000)

    return file_path