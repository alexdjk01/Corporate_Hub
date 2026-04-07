"use client";

import { useEffect, useState } from "react";

type Services = {
  ollama: boolean;
  comfyui: boolean;
  tts: boolean;
  stt: boolean;
};

export default function Dashboard() {
  const [services, setServices] = useState<Services | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/health/services")
      .then((res) => res.json())
      .then((data) =>
        setServices({
          ollama: Boolean(data.ollama),
          comfyui: Boolean(data.comfyui),
          tts: Boolean(data.tts),
          stt: Boolean(data.stt),
        })
      )
      .catch(() => setServices(null));
  }, []);

  const Card = ({ name, status }: { name: string; status: boolean }) => (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <h2 className="text-lg font-medium">{name}</h2>
      <p
        className={`mt-2 text-sm ${
          status ? "text-green-400" : "text-red-400"
        }`}
      >
        {status ? "Online" : "Offline"}
      </p>
    </div>
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

      {!services && <p className="text-neutral-400">Loading...</p>}

      {services && (
        <div className="grid grid-cols-2 gap-4">
          <Card name="Ollama" status={services.ollama} />
          <Card name="ComfyUI" status={services.comfyui} />
          <Card name="TTS" status={services.tts} />
          <Card name="STT" status={services.stt} />
        </div>
      )}
    </div>
  );
}