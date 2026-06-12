"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  FileText,
  ImageIcon,
  Mic,
  Settings,
  LogOut,
  Plus,
  Search,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Pin,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const topItems = [
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Images", href: "/images", icon: ImageIcon },
  { name: "Voice", href: "/voice", icon: Mic },
  { name: "Settings", href: "/settings", icon: Settings },
];

type StoredUser = {
  id?: number;
  email?: string;
  role?: string;
};

type Conversation = {
  id: number;
  title: string;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<StoredUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);

  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedPinned = localStorage.getItem("pinned_conversations");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }

    if (storedPinned) {
      try {
        setPinnedIds(JSON.parse(storedPinned));
      } catch {
        setPinnedIds([]);
      }
    }

    loadConversations();

    const interval = setInterval(loadConversations, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const newChat = () => {
    setOpenMenuId(null);
    router.push(`/chat?new=${Date.now()}`);
  };

  const openConversation = (id: number) => {
    setOpenMenuId(null);
    router.push(`/chat?conversation_id=${id}`);
  };

  const renameConversation = async (conv: Conversation) => {
    const title = window.prompt("Rename chat", conv.title || `Chat ${conv.id}`);
    if (!title || !title.trim()) return;

    try {
      const res = await fetch(`http://localhost:8000/conversations/${conv.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!res.ok) {
        alert("Could not rename chat.");
        return;
      }

      setOpenMenuId(null);
      await loadConversations();
    } catch {
      alert("Could not rename chat.");
    }
  };

  const deleteConversation = async (id: number) => {
    const confirmed = window.confirm("Delete this chat?");
    if (!confirmed) return;

    try {
      const res = await fetch(`http://localhost:8000/conversations/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        alert("Could not delete chat.");
        return;
      }

      setOpenMenuId(null);
      await loadConversations();

      const currentConversationId = searchParams.get("conversation_id");

      if (pathname === "/chat" && currentConversationId === String(id)) {
        router.replace(`/chat?new=${Date.now()}`);
      }
    } catch {
      alert("Could not delete chat.");
    }
  };

  const togglePin = (id: number) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [id, ...prev];

      localStorage.setItem("pinned_conversations", JSON.stringify(next));
      return next;
    });

    setOpenMenuId(null);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const sortedConversations = [...conversations].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id);
    const bPinned = pinnedIds.includes(b.id);

    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-blue-950/60 bg-[#07111f] px-3 py-4">
      <div className="mb-4 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
          <Bot size={20} />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">Corporate Hub AI</h1>
          <p className="text-xs text-blue-200/70">Local assistant</p>
        </div>
      </div>

      <button
        onClick={newChat}
        className="mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-blue-50 hover:bg-blue-950/60"
      >
        <Plus size={18} />
        New chat
      </button>

      <button className="mb-4 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-blue-100/80 hover:bg-blue-950/60">
        <Search size={18} />
        Search
      </button>

      <nav className="space-y-1 border-b border-blue-950/60 pb-4">
        {topItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                active
                  ? "bg-blue-900/70 text-white"
                  : "text-blue-100/80 hover:bg-blue-950/60 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex-1 overflow-y-auto">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-blue-300/60">
          Chats
        </p>

        <div className="space-y-1">
          {sortedConversations.length === 0 && (
            <p className="px-3 py-2 text-sm text-blue-200/40">No chats yet</p>
          )}

          {sortedConversations.map((conv) => {
            const pinned = pinnedIds.includes(conv.id);

            return (
              <div
                key={conv.id}
                className="group relative flex items-center rounded-xl hover:bg-blue-950/60"
              >
                <button
                  onClick={() => openConversation(conv.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 truncate px-3 py-2 text-left text-sm text-blue-100/80 hover:text-white"
                  title={conv.title}
                >
                  {pinned && <Pin size={13} className="shrink-0 text-blue-300" />}
                  <span className="truncate">{conv.title || `Chat ${conv.id}`}</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === conv.id ? null : conv.id);
                  }}
                  className="mr-1 rounded-lg p-1.5 text-blue-100/50 opacity-0 hover:bg-blue-900/70 hover:text-white group-hover:opacity-100"
                  title="Chat options"
                >
                  <MoreHorizontal size={16} />
                </button>

                {openMenuId === conv.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-2 top-9 z-50 w-44 rounded-xl border border-blue-900/70 bg-[#0b1728] p-1 shadow-xl shadow-black/40"
                  >
                    <button
                      onClick={() => renameConversation(conv)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-blue-100 hover:bg-blue-900/60"
                    >
                      <Pencil size={15} />
                      Rename
                    </button>

                    <button
                      onClick={() => togglePin(conv.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-blue-100 hover:bg-blue-900/60"
                    >
                      <Pin size={15} />
                      {pinned ? "Unpin" : "Pin"}
                    </button>

                    <button
                      onClick={() => deleteConversation(conv.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-950/50"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-blue-950/60 pt-4">
        <div className="mb-3 rounded-xl bg-blue-950/40 p-3">
          <p className="truncate text-sm font-medium text-white">
            {user?.email || "Unknown user"}
          </p>
          <p className="mt-1 text-xs capitalize text-blue-200/60">
            {user?.role || "member"}
          </p>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-900/70 px-3 py-2 text-sm text-blue-100 hover:bg-blue-950/60"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}