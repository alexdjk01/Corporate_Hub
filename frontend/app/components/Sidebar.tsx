"use client";

import Link from "next/link";

const items = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Chat", href: "/chat" },
  { name: "Images", href: "/images" },
  { name: "Voice", href: "/voice" },
  { name: "Settings", href: "/settings" },
];

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-gray-900 text-white p-4">
      <h1 className="text-xl font-bold mb-6">AI Hub</h1>

      <nav className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="p-2 rounded hover:bg-gray-700"
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}