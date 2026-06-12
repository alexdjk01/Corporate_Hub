"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const isLoginPage = useMemo(() => pathname === "/login", [pathname]);

  useEffect(() => {
    setMounted(true);
    setToken(localStorage.getItem("token"));
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const currentToken = localStorage.getItem("token");
    setToken(currentToken);

    if (!currentToken && !isLoginPage) {
      router.replace("/login");
      return;
    }

    if (currentToken && isLoginPage) {
      router.replace("/dashboard");
    }
  }, [mounted, isLoginPage, pathname, router]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-white">
        Loading...
      </div>
    );
  }

  if (!token && !isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-white">
        Redirecting to login...
      </div>
    );
  }

  if (token && isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220] text-white">
        Redirecting...
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#0b1220] text-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}