"use client";

import { Settings, Database, Cpu, Shield } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex h-screen flex-col bg-[#0b1220] text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-blue-950/50 px-8">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-sm text-blue-200/60">Application configuration overview</p>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-8 hide-scrollbar">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6 shadow-xl shadow-black/20">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-blue-600 p-3 text-white">
                <Settings size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Corporate Hub AI Settings
                </h2>
                <p className="mt-1 text-sm text-blue-200/60">
                  This page summarizes the local configuration of the application.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-5">
              <Database className="mb-4 text-blue-300" size={24} />
              <h3 className="font-medium text-white">Database</h3>
              <p className="mt-2 text-sm text-blue-200/60">
                MySQL stores users, conversations, messages and image metadata.
              </p>
            </div>

            <div className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-5">
              <Cpu className="mb-4 text-blue-300" size={24} />
              <h3 className="font-medium text-white">Local AI services</h3>
              <p className="mt-2 text-sm text-blue-200/60">
                Ollama, ComfyUI, Whisper and TTS services run locally.
              </p>
            </div>

            <div className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-5">
              <Shield className="mb-4 text-blue-300" size={24} />
              <h3 className="font-medium text-white">Authentication</h3>
              <p className="mt-2 text-sm text-blue-200/60">
                Requests are protected using bearer tokens stored after login.
              </p>
            </div>
          </div>

          <section className="rounded-3xl border border-blue-900/50 bg-[#111c2f] p-6">
            <h2 className="text-xl font-semibold text-white">Current setup</h2>

            <div className="mt-5 grid gap-3 text-sm">
              <div className="rounded-2xl bg-[#0b1728] px-4 py-3 text-blue-100">
                Frontend: http://localhost:3000
              </div>
              <div className="rounded-2xl bg-[#0b1728] px-4 py-3 text-blue-100">
                Backend: http://localhost:8000
              </div>
              <div className="rounded-2xl bg-[#0b1728] px-4 py-3 text-blue-100">
                ComfyUI: http://localhost:8188
              </div>
              <div className="rounded-2xl bg-[#0b1728] px-4 py-3 text-blue-100">
                Ollama: http://localhost:11434
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}