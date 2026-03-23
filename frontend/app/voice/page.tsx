"use client";

import { useRef, useState } from "react";

export default function VoicePage() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("af_sarah");
  const [loadingStt, setLoadingStt] = useState(false);
  const [loadingTts, setLoadingTts] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");

        setLoadingStt(true);
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
          setLoadingStt(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const generateSpeech = async () => {
    if (!ttsText.trim()) return;

    const formData = new FormData();
    formData.append("text", ttsText);
    formData.append("voice", selectedVoice);

    setLoadingTts(true);

    try {
      const res = await fetch("http://localhost:8000/voice/tts", {
        method: "POST",
        body: formData,
      });

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch {
      alert("Error while generating speech.");
    } finally {
      setLoadingTts(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Voice</h1>

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

        {loadingStt && (
          <p className="mt-4 text-sm text-neutral-400">Transcribing...</p>
        )}

        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-2 text-sm text-neutral-400">Transcript</p>
          <div className="whitespace-pre-wrap text-sm text-white">
            {transcript || "Speak something..."}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="mb-4 text-lg font-medium">Text to Speech</h2>

        <textarea
          rows={5}
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none"
          placeholder="Type text to generate speech..."
        />

        <div className="mt-4 flex gap-3">
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white"
          >
            <option value="af_heart">af_heart</option>
            <option value="af_bella">af_bella</option>
            <option value="af_nicole">af_nicole</option>
            <option value="af_sarah">af_sarah</option>
            <option value="bf_emma">bf_emma</option>
            <option value="bm_george">bm_george</option>
          </select>

          <button
            onClick={generateSpeech}
            disabled={loadingTts || !ttsText.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loadingTts ? "Generating..." : "Generate Voice"}
          </button>
        </div>

        <audio ref={audioRef} controls className="mt-4 w-full" />
      </div>
    </div>
  );
}