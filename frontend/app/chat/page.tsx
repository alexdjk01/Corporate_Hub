"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const currentInput = input;

    setMessages((prev) => [...prev, { role: "user", content: currentInput }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentInput,
          conversation_id: conversationId,
        }),
      });

      if (!res.ok) {
        throw new Error("Backend error");
      }

      const data = await res.json();

      setConversationId(data.conversation_id);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: could not get response from backend.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="flex h-[80vh] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <button
          onClick={newChat}
          className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-white"
        >
          New Chat
        </button>
      </div>

      <div className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400">
            Start a conversation with your local AI model.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-6 ${
              msg.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-100"
            }`}
          >
            {msg.role === "user" ? (
              msg.content
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <p className="text-sm text-neutral-400">AI is typing...</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none placeholder:text-neutral-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}