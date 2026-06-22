"use client";

import { useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";

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
        if (event.data.size > 0) chunksRef.current.push(event.data);
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
    <div className="flex h-screen flex-col bg-[#0b1220] text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-blue-950/50 px-8">
        <h1 className="text-lg font-semibold text-white">Voice</h1>
        <p className="text-sm text-blue-200/60">Speech-to-text and text-to-speech</p>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-8 hide-scrollbar">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6 shadow-xl shadow-black/20">
            <h2 className="text-xl font-semibold text-white">Speech to Text</h2>
            <p className="mt-2 text-sm text-blue-200/60">
              Record your voice and convert it into text using the local STT service.
            </p>

            <div className="mt-6">
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500"
                >
                  <Mic size={18} />
                  Start recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-500"
                >
                  <Square size={18} />
                  Stop recording
                </button>
              )}
            </div>

            {loadingStt && (
              <p className="mt-4 text-sm text-blue-200/60">Transcribing...</p>
            )}

            <div className="mt-6 rounded-3xl bg-[#0b1728] p-5">
              <p className="mb-2 text-sm text-blue-200/50">Transcript</p>
              <div className="min-h-32 whitespace-pre-wrap text-sm leading-6 text-white">
                {transcript || "Your transcription will appear here."}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6 shadow-xl shadow-black/20">
            <h2 className="text-xl font-semibold text-white">Text to Speech</h2>
            <p className="mt-2 text-sm text-blue-200/60">
              Convert written text into audio using the local TTS service.
            </p>

            <textarea
              rows={7}
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              className="mt-6 w-full rounded-3xl border border-blue-900/60 bg-[#0b1728] px-5 py-4 text-white outline-none placeholder:text-blue-200/40"
              placeholder="Type text to generate speech..."
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="rounded-2xl border border-blue-900/60 bg-[#0b1728] px-4 py-3 text-white outline-none"
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
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Volume2 size={18} />
                {loadingTts ? "Generating..." : "Generate voice"}
              </button>
            </div>

            <audio ref={audioRef} controls className="mt-6 w-full" />
          </section>
        </div>
      </main>
    </div>
  );
}