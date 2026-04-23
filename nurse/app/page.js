"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { buildApiUrl } from "./lib/api";

export default function NurseLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("nurseUser");
    if (token && user) router.replace("/nurse/dashboard");
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/users/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      const user = data.user || data;
      if (user.role !== "NURSE" && user.role !== "HOSPITAL_ADMIN" && user.role !== "SUPER_ADMIN") {
        throw new Error("Access denied. Nurse credentials required.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("nurseUser", JSON.stringify(user));
      toast.success(`Welcome, ${user.name}!`);
      router.push("/nurse/dashboard");
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="nurse-card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-50 to-emerald-100 rounded-2xl border border-emerald-100 flex items-center justify-center">
            <svg className="w-9 h-9 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Nurse Panel</h1>
          <p className="text-slate-500 text-sm mt-1">Hospital staff management system</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              required
              className="nurse-input w-full mt-1"
              placeholder="nurse@hospital.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              required
              className="nurse-input w-full mt-1"
              placeholder="********"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            />
          </div>
          <button type="submit" disabled={loading} className="nurse-btn-primary w-full mt-2 disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Access restricted to authorized nursing staff only.
        </p>
      </div>
    </div>
  );
}
