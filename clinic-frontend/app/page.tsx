"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { buildApiUrl } from "@/lib/api";
import { saveSession, dashboardPathForRole, getStoredToken, getStoredUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in redirect to appropriate dashboard
  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser<{ role: string }>();
    if (token && user?.role) {
      router.replace(dashboardPathForRole(user.role));
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/users/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed");

      const { role } = data.user;
      const allowed = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "RECEPTIONIST"];
      if (!allowed.includes(role)) {
        throw new Error("Access denied. This portal is for clinic staff only.");
      }

      saveSession(data.token, data.user);
      toast.success(`Welcome, ${data.user.name || "User"}!`);
      router.push(dashboardPathForRole(role));
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-teal-50 relative overflow-hidden">
      <Toaster position="top-right" />

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 left-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], rotate: [90, 0, 90], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-20 right-20 w-96 h-96 bg-teal-400 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10 px-4"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
            className="inline-block mb-4"
          >
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center text-white font-bold text-2xl shadow-xl mx-auto">
              DC
            </div>
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900">Dermatology Clinic</h1>
          <p className="text-gray-500 mt-1 text-sm">Clinic Management Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in to continue to your dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="you@clinic.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-teal-500 text-white py-2.5 rounded-lg font-semibold text-sm hover:from-blue-700 hover:to-teal-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            First time?{" "}
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="text-blue-600 hover:underline font-medium"
            >
              Create admin account
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
