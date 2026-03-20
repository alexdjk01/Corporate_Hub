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
      .then((data) => setServices(data))
      .catch(() => setServices(null));
  }, []);

  const Card = ({ name, status }: { name: string; status: boolean }) => (
    <div className="p-5 bg-neutral-900 rounded-xl border border-neutral-800">
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
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

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