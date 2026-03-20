"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
      const res = await fetch("http://localhost:8000/conversations");
      const data = await res.json();
      setConversations(data);
    } catch {
      setConversations([]);
    }
  };

  const loadConversation = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/conversations/${id}`);
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
      const res = await fetch("http://localhost:8000/conversations/latest");
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
  }, [messages, loading]);

  useEffect(() => {
    autoResizeTextarea();
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const currentInput = input.trim();

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

  const deleteChat = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/conversations/${id}`, {
        method: "DELETE",
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[80vh] gap-4">
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
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="w-fit rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-300">
              AI is typing...
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
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}