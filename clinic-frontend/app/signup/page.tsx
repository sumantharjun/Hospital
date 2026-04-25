"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { buildApiUrl } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/users/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "SUPER_ADMIN" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Signup failed");
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-teal-50 px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.08, 0.15, 0.08] }} transition={{ duration: 20, repeat: Infinity }} className="absolute top-20 left-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        <motion.div animate={{ scale: [1.2, 1, 1.2], rotate: [90, 0, 90], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 15, repeat: Infinity }} className="absolute bottom-20 right-20 w-96 h-96 bg-teal-400 rounded-full blur-3xl" />
      </div>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center text-white font-bold text-xl shadow-lg mx-auto mb-3">DC</div>
            <h1 className="text-2xl font-bold text-gray-900">Create Admin Account</h1>
            <p className="text-gray-500 text-sm mt-1">This account will have full admin access.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input type="text" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-teal-500 text-white py-2.5 rounded-lg font-semibold text-sm hover:from-blue-700 hover:to-teal-600 transition-all disabled:opacity-60 shadow-md">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-500">Already have an account? <button type="button" onClick={() => router.push("/")} className="text-blue-600 hover:underline font-medium">Sign in</button></p>
        </div>
      </motion.div>
    </div>
  );
}
