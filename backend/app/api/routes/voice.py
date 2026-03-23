from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import FileResponse
import os
import uuid

from app.services.stt_service import transcribe_audio_file
from app.services.tts_service import synthesize_speech

router = APIRouter()

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/voice/stt")
async def speech_to_text(file: UploadFile = File(...)):
    file_id = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, file_id)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        transcript = transcribe_audio_file(file_path)
        return {"transcript": transcript}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/voice/tts")
async def text_to_speech(
    text: str = Form(...),
    voice: str = Form("af_sarah"),
):
    audio_path = synthesize_speech(text=text, voice=voice)
    return FileResponse(audio_path, media_type="audio/wav", filename="speech.wav")