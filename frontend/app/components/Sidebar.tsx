"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Chat", href: "/chat" },
  { name: "Images", href: "/images" },
  { name: "Voice", href: "/voice" },
  { name: "Settings", href: "/settings" },
  { name: "Documents", href: "/documents" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-screen bg-neutral-900 border-r border-neutral-800 p-5">
      <h1 className="text-xl font-semibold mb-8">AI Hub</h1>

      <nav className="flex flex-col gap-2">
        {items.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`px-3 py-2 rounded-lg transition ${
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
  );
}