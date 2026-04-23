"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl } from "./lib/api";
import SuccessModal from "./components/SuccessModal";
import LoadingSpinner from "./components/LoadingSpinner";

function EyeIcon({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState({ open: false, message: "" });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("token");
    if (token) router.replace("/reception/dashboard");
  }, [mounted, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/users/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed");

      const role = data.user?.role || "";
      const allowed = ["RECEPTIONIST", "HOSPITAL_ADMIN", "SUPER_ADMIN"];
      if (!allowed.includes(role)) {
        toast.error("Access denied. This portal is for receptionists only.");
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setSuccessModal({ open: true, message: "Login successful. Redirecting to dashboard…" });
      setTimeout(() => router.push("/reception/dashboard"), 1200);
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SuccessModal open={successModal.open} title="Welcome" message={successModal.message} onClose={() => setSuccessModal({ open: false, message: "" })} />
      {!mounted ? (
        <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md border-2 border-[#cbd5e0] bg-white p-8">
            <div className="h-8 w-48 mx-auto bg-[#e2e8f0] animate-pulse" />
            <div className="mt-6 h-4 w-full bg-[#e2e8f0] animate-pulse" />
          </div>
        </div>
      ) : (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center px-6 py-16">
      <section className="w-full max-w-md">
        <div className="border-2 border-[#cbd5e0] bg-white p-8 shadow-sm">
          <div className="text-center mb-6 pb-4 border-b-2 border-[#0d47a1]">
            <div className="w-14 h-14 rounded-sm bg-[#0d47a1] flex items-center justify-center text-white text-lg font-bold mx-auto border-2 border-[#0a3d91]">
              OPD
            </div>
            <h1 className="mt-3 text-xl font-bold text-[#1a202c] uppercase tracking-tight">
              OPD Reception — Login
            </h1>
            <p className="mt-1 text-sm text-[#4a5568]">
              Medical Portal · Walk-in & OPD Desk
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#2d3748]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reception@hospital.gov.in"
                required
                className="mt-1 w-full border border-[#a0aec0] bg-white px-4 py-2.5 text-[#1a202c] placeholder:text-[#718096] focus:outline-2 focus:outline-[#1565c0] focus:outline-offset-0"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[#2d3748]">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full border border-[#a0aec0] bg-white px-4 py-2.5 pr-12 text-[#1a202c] placeholder:text-[#718096] focus:outline-2 focus:outline-[#1565c0] focus:outline-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded border border-[#cbd5e0] bg-[#edf2f7] text-[#4a5568] hover:bg-[#e2e8f0] hover:text-[#0d47a1] transition focus:outline-none focus:ring-2 focus:ring-[#1565c0] focus:ring-offset-0"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOffIcon className="w-5 h-5 shrink-0" aria-hidden />
                  ) : (
                    <EyeIcon className="w-5 h-5 shrink-0" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0d47a1] hover:bg-[#0a3d91] py-2.5 text-sm font-semibold text-white border-2 border-[#0a3d91] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><LoadingSpinner size="sm" white /> Signing in…</> : "Sign in"}
            </button>
          </form>
          <p className="mt-4 text-xs text-[#718096] text-center">
            For official use only. Authorised personnel only.
          </p>
        </div>
      </section>
    </div>
      )}
    </>
  );
}
