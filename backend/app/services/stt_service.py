from faster_whisper import WhisperModel

model = WhisperModel("base", device="cpu", compute_type="int8")


def transcribe_audio_file(file_path: str) -> str:
    segments, _ = model.transcribe(
        file_path,
        language="en",
        task="transcribe",
        beam_size=5,
        vad_filter=True,
    )

    parts = []

    for segment in segments:
        parts.append(segment.text.strip())

    return " ".join(part for part in parts if part).strip()