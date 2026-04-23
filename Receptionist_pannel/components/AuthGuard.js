"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const TOKEN_KEY = "recption_token";

export function useAuth() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem(TOKEN_KEY);
    const u = localStorage.getItem("recption_user");
    setToken(t);
    setUser(u ? JSON.parse(u) : null);
    setReady(true);
  }, []);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("recption_user");
    setToken(null);
    setUser(null);
  };

  return { token, user, ready, logout, isLoggedIn: !!token };
}

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    const isLogin = pathname === "/login";
    if (!token && !isLogin) {
      router.replace("/login");
      return;
    }
    if (token && isLogin) {
      router.replace("/dashboard");
    }
  }, [ready, token, pathname, router]);

  if (!ready || (!token && pathname !== "/login")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="animate-pulse text-slate-500">Loading…</div>
      </div>
    );
  }

  return children;
}
