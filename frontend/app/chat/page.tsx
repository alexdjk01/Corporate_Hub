"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Mic, Square, Volume2, Paperclip, Download } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  kind?: "normal" | "status" | "success" | "error";
};

type Conversation = {
  id: number;
  title: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"chat" | "image">("chat");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
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
      160
    )}px`;
  };

  const addAssistantMessage = (
    content: string,
    kind: "status" | "success" | "error" = "status"
  ) => {
    setMessages((prev) => [...prev, { role: "assistant", content, kind }]);
  };

  const isImageRequest = (text: string) => {
    const value = text.trim().toLowerCase();

    const triggers = [
      "generate me an image",
      "generate an image",
      "create an image",
      "make an image",
      "give me an image",
      "give me a picture",
      "show me an image",
      "show me a picture",
      "generate a picture",
      "create a picture",
      "make a picture",
      "generate image of",
      "generate picture of",
      "create image of",
      "create picture of",
    ];

    return triggers.some((trigger) => value.includes(trigger));
  };

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

      setImageUrls((prev) => {
        if (prev[imageId]) {
          URL.revokeObjectURL(url);
          return prev;
        }
        return { ...prev, [imageId]: url };
      });
    } catch {}
  };

  const downloadImage = async (imageId: number) => {
    try {
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
    } catch {
      alert("Could not download image.");
    }
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
    const init = async () => {
      await loadConversations();
      await loadLatestConversation();
    };

    init();
  }, []);

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

  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  const sendMessage = async () => {
    if (!input.trim() || loading || transcribing || uploadingDoc) return;

    const currentInput = input.trim();
    const imageMode = isImageRequest(currentInput);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: currentInput, kind: "normal" },
    ]);
    setInput("");
    setLoading(true);
    setLoadingMode(imageMode ? "image" : "chat");

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

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", kind: "normal" },
      ]);

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
            kind: "normal",
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
          kind: "error",
        },
      ]);
    } finally {
      setLoading(false);
      setLoadingMode("chat");
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
    setUseRag(false);
    setAttachedFileName(null);
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

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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

    setUploadingDoc(true);
    addAssistantMessage(
      `Uploading and indexing document: ${file.name}...`,
      "status"
    );

    try {
      const res = await fetch("http://localhost:8000/rag/upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || "Could not attach file.");
        addAssistantMessage(
          `Failed to attach file${file.name ? `: ${file.name}` : "."}`,
          "error"
        );
        return;
      }

      setUseRag(true);
      setAttachedFileName(file.name);
      addAssistantMessage("Document was reviewed successfully.", "success");
    } catch {
      alert("Could not attach file.");
      addAssistantMessage(
        `Failed to attach file${file.name ? `: ${file.name}` : "."}`,
        "error"
      );
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

  return (
    <div className="flex h-[80vh] gap-4">
      <audio ref={audioRef} hidden />
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf"
        className="hidden"
        onChange={handleFileSelected}
      />

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

          {messages.map((msg, i) => {
            const isStatus = msg.kind === "status";
            const isSuccess = msg.kind === "success";
            const isError = msg.kind === "error";
            const imageId =
              msg.role === "assistant" ? extractGeneratedImageId(msg.content) : null;
            const visibleContent =
              msg.role === "assistant"
                ? stripGeneratedImageMarker(msg.content)
                : msg.content;

            return (
              <div
                key={i}
                className={`w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  msg.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : isSuccess
                    ? "border border-green-600/40 bg-green-500/10 text-green-300"
                    : isError
                    ? "border border-red-600/40 bg-red-500/10 text-red-300"
                    : isStatus
                    ? "border border-blue-700/40 bg-blue-500/10 text-blue-200"
                    : "bg-neutral-800 text-neutral-100"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : isStatus || isSuccess || isError ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div>
                    {!imageId && (
                      <div className="mb-2 flex items-center gap-2">
                        <button
                          onClick={() => playTts(visibleContent, i)}
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
                    )}

                    {visibleContent && (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{visibleContent}</ReactMarkdown>
                      </div>
                    )}

                    {imageId && (
                      <div className="mt-3 space-y-3">
                        {imageUrls[imageId] ? (
                          <>
                            <img
                              src={imageUrls[imageId]}
                              alt="Generated chat image"
                              className="max-h-[420px] rounded-xl border border-neutral-700"
                            />
                            <button
                              onClick={() => downloadImage(imageId)}
                              className="inline-flex items-center gap-2 rounded-lg bg-neutral-700 px-3 py-2 text-sm text-white hover:bg-neutral-600"
                            >
                              <Download size={16} />
                              Download image
                            </button>
                          </>
                        ) : (
                          <div className="text-sm text-neutral-400">
                            Loading generated image...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="w-fit rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-300">
              {loadingMode === "image" ? "Generating image..." : "AI is typing..."}
            </div>
          )}

          {transcribing && (
            <div className="w-fit rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-300">
              Transcribing audio...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="mb-2 text-xs text-neutral-500">
          {attachedFileName && useRag
            ? `Document mode enabled: ${attachedFileName}`
            : "You can now generate images"}
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

          <div className="flex items-center gap-2">
            <button
              onClick={handleAttachClick}
              disabled={loading || transcribing || uploadingDoc}
              className="flex items-center justify-center rounded-xl bg-neutral-800 px-4 py-3 text-white hover:bg-neutral-700 disabled:opacity-50"
              title="Attach document for chat with documents"
            >
              <Paperclip size={18} />
            </button>

            <button
              onClick={handleMicClick}
              disabled={loading || transcribing || uploadingDoc}
              className={`flex items-center justify-center rounded-xl px-4 py-3 text-white disabled:opacity-50 ${
                recording ? "bg-red-600" : "bg-neutral-800 hover:bg-neutral-700"
              }`}
              title={recording ? "Stop recording" : "Start recording"}
            >
              {recording ? <Square size={18} /> : <Mic size={18} />}
            </button>
          </div>

          <button
            onClick={sendMessage}
            disabled={loading || transcribing || uploadingDoc || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50 hover:bg-blue-500"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}