"use client";

import { useState, useRef } from "react";

export default function VoicePage() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      chunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });

      const formData = new FormData();
      formData.append("file", blob, "recording.webm");

      setLoading(true);
      setTranscript("");

      try {
        const res = await fetch("http://localhost:8000/voice/stt", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        setTranscript(data.transcript || "No transcript returned.");
      } catch {
        setTranscript("Error while transcribing audio.");
      } finally {
        setLoading(false);
      }
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Voice</h1>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="mb-4 text-lg font-medium">Speech to Text</h2>

        <div className="flex gap-4">
          {!recording ? (
            <button
              onClick={startRecording}
              className="rounded-xl bg-green-600 px-5 py-3 font-medium text-white"
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="rounded-xl bg-red-600 px-5 py-3 font-medium text-white"
            >
              Stop Recording
            </button>
          )}
        </div>

        {loading && (
          <p className="mt-4 text-sm text-neutral-400">
            Transcribing...
          </p>
        )}

        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-2 text-sm text-neutral-400">Transcript</p>
          <div className="whitespace-pre-wrap text-sm text-white">
            {transcript || "Speak something..."}
          </div>
        </div>
      </div>
    </div>
  );
}