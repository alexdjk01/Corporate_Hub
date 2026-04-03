"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Mic, Square, Volume2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: number;
  title: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAuthHeaders = (includeJson = false): HeadersInit => {
    const token = localStorage.getItem("token") || "";
    if (includeJson) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const autoResizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      160
    )}px`;
  };

  const loadConversations = async () => {
    try {
      const res = await fetch("http://localhost:8000/conversations", {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        setConversations([]);
        return;
      }

      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setConversations([]);
    }
  };

  const loadConversation = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/conversations/${id}`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) return;

      const data = await res.json();

      if (data.messages) {
        setConversationId(id);
        setMessages(
          data.messages.map((msg: Message) => ({
            role: msg.role,
            content: msg.content,
          }))
        );
      }
    } catch {}
  };

  const loadLatestConversation = async () => {
    try {
      const res = await fetch("http://localhost:8000/conversations/latest", {
        headers: getAuthHeaders(),
      });

      if (!res.ok) return;

      const data = await res.json();

      if (data && data.id && data.messages) {
        setConversationId(data.id);
        setMessages(
          data.messages.map((msg: Message) => ({
            role: msg.role,
            content: msg.content,
          }))
        );
      }
    } catch {}
  };

  useEffect(() => {
    const init = async () => {
      await loadConversations();
      await loadLatestConversation();
    };

    init();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, transcribing]);

  useEffect(() => {
    autoResizeTextarea();
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || loading || transcribing) return;

    const currentInput = input.trim();

    setMessages((prev) => [...prev, { role: "user", content: currentInput }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          message: currentInput,
          conversation_id: conversationId,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Backend error");
      }

      const newConversationId = res.headers.get("X-Conversation-Id");
      if (newConversationId) {
        setConversationId(Number(newConversationId));
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return updated;
        });
      }

      await loadConversations();
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

  const playTts = async (text: string, index: number) => {
    if (!text.trim()) return;

    try {
      setSpeakingIndex(index);

      const formData = new FormData();
      formData.append("text", text);
      formData.append("voice", "af_sarah");

      const res = await fetch("http://localhost:8000/voice/tts", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!res.ok) {
        throw new Error("TTS failed");
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => setSpeakingIndex(null);
        audioRef.current.play();
      }
    } catch {
      setSpeakingIndex(null);
      alert("Could not generate voice.");
    }
  };

  const deleteChat = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/conversations/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const wasCurrent = conversationId === id;

      if (wasCurrent) {
        setConversationId(null);
        setMessages([]);
      }

      await loadConversations();

      if (wasCurrent) {
        await loadLatestConversation();
      }
    } catch {}
  };

  const newChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

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

        setTranscribing(true);

        try {
          const res = await fetch("http://localhost:8000/voice/stt", {
            method: "POST",
            headers: getAuthHeaders(),
            body: formData,
          });

          const data = await res.json();
          const transcript = (data.transcript || "").trim();

          if (transcript) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        } catch {
          setInput((prev) =>
            prev ? `${prev} [Transcription failed]` : "[Transcription failed]"
          );
        } finally {
          setTranscribing(false);
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

  const handleMicClick = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[80vh] gap-4">
      <audio ref={audioRef} hidden />

      <div className="w-72 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chats</h2>
          <button
            onClick={newChat}
            className="rounded-lg border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            New
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`flex items-center gap-2 rounded-xl px-2 py-2 ${
                conversationId === conv.id ? "bg-neutral-800" : "bg-neutral-900"
              }`}
            >
              <button
                onClick={() => loadConversation(conv.id)}
                className="flex-1 truncate text-left text-sm text-neutral-200"
                title={conv.title}
              >
                {conv.title}
              </button>

              <button
                onClick={() => deleteChat(conv.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Chat</h1>
        </div>

        <div className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-400">
              Start a conversation with your local AI model.
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                msg.role === "user"
                  ? "ml-auto bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-100"
              }`}
            >
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      onClick={() => playTts(msg.content, i)}
                      disabled={speakingIndex === i}
                      className="rounded-lg bg-neutral-700 p-2 text-neutral-200 hover:bg-neutral-600 disabled:opacity-50"
                      title="Read aloud"
                    >
                      <Volume2 size={16} />
                    </button>

                    {speakingIndex === i && (
                      <span className="text-xs text-neutral-400">Playing...</span>
                    )}
                  </div>

                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="w-fit rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-300">
              AI is typing...
            </div>
          )}

          {transcribing && (
            <div className="w-fit rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-300">
              Transcribing audio...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-end gap-2 rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
          <textarea
            ref={textareaRef}
            rows={1}
            className="max-h-40 flex-1 resize-none overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none placeholder:text-neutral-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          />

          <button
            onClick={handleMicClick}
            disabled={loading || transcribing}
            className={`flex items-center justify-center rounded-xl px-4 py-3 text-white disabled:opacity-50 ${
              recording ? "bg-red-600" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
            title={recording ? "Stop recording" : "Start recording"}
          >
            {recording ? <Square size={18} /> : <Mic size={18} />}
          </button>

          <button
            onClick={sendMessage}
            disabled={loading || transcribing || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50 hover:bg-blue-500"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}