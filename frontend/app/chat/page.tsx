"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Mic, Square, Volume2, Paperclip, Send, Download  } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  kind?: "normal" | "status" | "success" | "error";
};

export default function ChatPage() {
  const searchParams = useSearchParams();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const [useRag, setUseRag] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getAuthHeaders = (includeJson = false): Record<string, string> => {
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
      180
    )}px`;
  };

  const addAssistantMessage = (
    content: string,
    kind: "status" | "success" | "error" = "status"
  ) => {
    setMessages((prev) => [...prev, { role: "assistant", content, kind }]);
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
            kind: "normal",
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
            kind: "normal",
          }))
        );
      }
    } catch {}
  };

  useEffect(() => {
    const newChatParam = searchParams.get("new");
    const conversationParam = searchParams.get("conversation_id");

    if (newChatParam) {
      setMessages([]);
      setConversationId(null);
      setInput("");
      setUseRag(false);
      setAttachedFileName(null);
      return;
    }

    if (conversationParam) {
      loadConversation(Number(conversationParam));
      return;
    }

    loadLatestConversation();
  }, [searchParams]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, transcribing, uploadingDoc]);

  useEffect(() => {
    autoResizeTextarea();
  }, [input]);

  useEffect(() => {
  messages.forEach((msg) => {
    if (msg.role !== "assistant") return;

    const imageId = extractGeneratedImageId(msg.content);
    if (imageId) {
      loadImageBlobUrl(imageId);
    }
  });
  }, [messages]);

  const extractGeneratedImageId = (content: string): number | null => {
  const match = content.match(/\[\[generated_image:(\d+)\]\]/);
  return match ? Number(match[1]) : null;
};

const stripGeneratedImageMarker = (content: string): string => {
  return content.replace(/\[\[generated_image:\d+\]\]/g, "").trim();
};

const loadImageBlobUrl = async (imageId: number) => {
  if (imageUrls[imageId]) return;

  try {
    const res = await fetch(`http://localhost:8000/images/${imageId}/file`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    setImageUrls((prev) => ({
      ...prev,
      [imageId]: url,
    }));
  } catch {}
};

const downloadImage = async (imageId: number) => {
  const res = await fetch(`http://localhost:8000/images/${imageId}/file`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    alert("Could not download image.");
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat_image_${imageId}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || transcribing || uploadingDoc) return;

    const currentInput = input.trim();

    setMessages((prev) => [
      ...prev,
      { role: "user", content: currentInput, kind: "normal" },
    ]);

    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          message: currentInput,
          conversation_id: conversationId,
          use_rag: useRag,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Backend error");
      }

      const newConversationId = res.headers.get("X-Conversation-Id");
      if (newConversationId) {
        setConversationId(Number(newConversationId));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let assistantText = "";
      let assistantMessageCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;

        if (!assistantMessageCreated && assistantText.trim()) {
          assistantMessageCreated = true;
          setLoading(false);

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: assistantText,
              kind: "normal",
            },
          ]);

          continue;
        }

        if (assistantMessageCreated) {
          setMessages((prev) => {
            const updated = [...prev];

            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantText,
              kind: "normal",
            };

            return updated;
          });
        }
      }

      if (!assistantMessageCreated) {
        setLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I could not generate a response.",
            kind: "error",
          },
        ]);
      }
    } catch {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: could not get response from backend.",
          kind: "error",
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

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const valid =
      file.name.toLowerCase().endsWith(".txt") ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!valid) {
      alert("Only .txt and .pdf files are supported.");
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("scope", "conversation");

    if (conversationId !== null) {
      formData.append("conversation_id", String(conversationId));
    }

    setUploadingDoc(true);
    addAssistantMessage(`Uploading and indexing document: ${file.name}...`, "status");

    try {
      const res = await fetch("http://localhost:8000/rag/upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (data.conversation_id) {
        setConversationId(Number(data.conversation_id));
      }

      if (!res.ok || data.error) {
        alert(data.error || "Could not attach file.");
        addAssistantMessage(`Failed to attach file: ${file.name}`, "error");
        return;
      }

      setUseRag(true);
      setAttachedFileName(file.name);
      addAssistantMessage("Document was reviewed successfully.", "success");
    } catch {
      alert("Could not attach file.");
      addAssistantMessage(`Failed to attach file: ${file.name}`, "error");
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderInputBox = () => (
    <div className="w-full rounded-3xl border border-blue-900/50 bg-[#111c2f] p-3 shadow-xl shadow-black/20">
      <textarea
        ref={textareaRef}
        rows={messages.length === 0 ? 2 : 1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="max-h-40 w-full resize-none bg-transparent px-3 py-2 text-slate-100 outline-none placeholder:text-blue-200/40"
        placeholder="Ask anything"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAttachClick}
            disabled={loading || transcribing || uploadingDoc}
            className="rounded-full p-2 text-blue-100 hover:bg-blue-950/70 disabled:opacity-50"
            title="Attach document"
          >
            <Paperclip size={18} />
          </button>

          <button
            onClick={() => setUseRag((prev) => !prev)}
            className={`rounded-full px-3 py-2 text-xs ${
              useRag ? "bg-blue-600 text-white" : "bg-blue-950/70 text-blue-100"
            }`}
          >
            {useRag ? "RAG on" : "RAG off"}
          </button>

          {attachedFileName && (
            <span className="hidden max-w-[220px] truncate text-xs text-blue-200/50 md:inline">
              {attachedFileName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMicClick}
            disabled={loading || transcribing || uploadingDoc}
            className={`rounded-full p-2 disabled:opacity-50 ${
              recording
                ? "bg-red-600 text-white"
                : "text-blue-100 hover:bg-blue-950/70"
            }`}
            title={recording ? "Stop recording" : "Start recording"}
          >
            {recording ? <Square size={18} /> : <Mic size={18} />}
          </button>

          <button
            onClick={sendMessage}
            disabled={loading || transcribing || uploadingDoc || !input.trim()}
            className="rounded-full bg-white p-2 text-[#0b1220] disabled:opacity-40"
            title="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-[#0b1220] text-slate-100">
      <audio ref={audioRef} hidden />

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf"
        className="hidden"
        onChange={handleFileSelected}
      />

      <header className="flex h-14 items-center justify-end border-b border-blue-950/50 px-6">
        <div className="text-sm text-blue-200/70">
          {useRag ? "Document mode enabled" : "Normal mode"}
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center">
              <h1 className="mb-8 text-3xl font-semibold text-white">
                What are you working on?
              </h1>

              <div className="w-full max-w-3xl">{renderInputBox()}</div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-8">
              {messages.map((msg, i) => {
                const isStatus = msg.kind === "status";
                const isSuccess = msg.kind === "success";
                const isError = msg.kind === "error";

                return (
                  <div key={i}>
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] rounded-3xl bg-blue-700 px-5 py-3 text-sm leading-6 text-white">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                          AI
                        </div>

                        <div
                          className={`min-w-0 flex-1 text-sm leading-7 ${
                            isSuccess
                              ? "text-green-300"
                              : isError
                              ? "text-red-300"
                              : isStatus
                              ? "text-blue-300"
                              : "text-slate-100"
                          }`}
                        >
                          {(() => {
                                      const imageId = extractGeneratedImageId(msg.content);
                                      const visibleContent = stripGeneratedImageMarker(msg.content);

                                      return (
                                        <>
                                          {visibleContent && (
                                            <div className="prose prose-invert prose-sm max-w-none prose-p:text-slate-100 prose-li:text-slate-100 prose-strong:text-white">
                                              <ReactMarkdown>{visibleContent}</ReactMarkdown>
                                            </div>
                                          )}

                                          {imageId && (
                                            <div className="mt-4 space-y-3">
                                              {imageUrls[imageId] ? (
                                                <>
                                                  <img
                                                    src={imageUrls[imageId]}
                                                    alt="Generated image"
                                                    className="max-h-[420px] rounded-2xl border border-blue-900/60"
                                                  />

                                                  <button
                                                    onClick={() => downloadImage(imageId)}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
                                                  >
                                                    <Download size={15} />
                                                    Download image
                                                  </button>
                                                </>
                                              ) : (
                                                <p className="text-sm text-blue-200/60">
                                                  Loading generated image...
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}

                          {!isStatus && !isSuccess && !isError && msg.content.trim() && (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => playTts(stripGeneratedImageMarker(msg.content), i)}
                                disabled={speakingIndex === i}
                                className="rounded-lg p-2 text-blue-200/70 hover:bg-blue-950/60 disabled:opacity-50"
                                title="Read aloud"
                              >
                                <Volume2 size={16} />
                              </button>

                              {speakingIndex === i && (
                                <span className="text-xs text-blue-200/50">
                                  Playing...
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                    AI
                  </div>
                  <div className="rounded-2xl bg-blue-950/40 px-4 py-3 text-sm text-blue-100">
                    Thinking...
                  </div>
                </div>
              )}

              {transcribing && (
                <div className="text-sm text-blue-200/70">
                  Transcribing audio...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <div className="border-t border-blue-950/50 px-6 py-4">
            <div className="mx-auto max-w-3xl">{renderInputBox()}</div>

            <p className="mt-2 text-center text-xs text-blue-200/40">
              Corporate Hub AI can make mistakes. Verify important information.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}