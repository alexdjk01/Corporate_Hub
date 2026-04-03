"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User as UserIcon, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

const items = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Chat", href: "/chat" },
  { name: "Documents", href: "/documents" },
  { name: "Voice", href: "/voice" },
  { name: "Settings", href: "/settings" },
];

type StoredUser = {
  id?: number;
  email?: string;
  role?: string;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r border-neutral-800 bg-neutral-900 p-5">
      <div>
        <h1 className="mb-8 text-xl font-semibold">AI Hub</h1>

        <nav className="flex flex-col gap-2">
          {items.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`rounded-lg px-3 py-2 transition ${
                  active
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-neutral-800 pt-4">
        <div className="mb-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-neutral-800 p-2">
              <UserIcon size={18} className="text-neutral-200" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user?.email || "Unknown user"}
              </p>
              <p className="mt-1 text-xs capitalize text-neutral-400">
                {user?.role || "member"}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
}