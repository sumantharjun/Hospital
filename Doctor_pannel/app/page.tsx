"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiPatch } from "@/lib/api";
import { getSocket } from "@/lib/socket";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check if already logged in
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      const user = localStorage.getItem("user");
      if (token && user) {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, mfaCode: requiresMFA ? mfaCode : undefined }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresMFA && !mfaCode) {
          setRequiresMFA(true);
          setLoading(false);
          return;
        }

        // Store token and user data
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        // Socket is already initialized in SocketProvider, just get it
        const socket = getSocket();
        const userId = data.user.id || data.user._id;
        
        // Register user as online with backend immediately
        try {
          // Call API to register user as online (this tracks login time)
          await fetch(`${API_BASE}/api/users/${userId}/online`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.token}`,
            },
          });
          console.log("Registered user as online via API:", userId);
        } catch (err) {
          console.error("Failed to register as online:", err);
        }
        
        // Wait for socket to connect, then emit user online event
        // This is what makes them show as "Online" in admin panel
        const emitOnlineEvent = () => {
          if (socket && socket.connected) {
            console.log("Emitting user:online event for userId:", userId);
            socket.emit("user:online", { userId });
          }
        };
        
        if (socket) {
          if (socket.connected) {
            emitOnlineEvent();
          } else {
            socket.once("connect", () => {
              console.log("Socket connected, emitting user:online");
              emitOnlineEvent();
            });
          }
        }
        
        // Update user status to AVAILABLE in database (for doctor's own panel)
        try {
          await apiPatch(`/api/users/${userId}`, { 
            status: "AVAILABLE" 
          });
        } catch (err) {
          console.error("Failed to update status on login:", err);
          // Continue with login even if status update fails
        }
        
        // Redirect to dashboard
        router.push("/dashboard");
      } else {
        setError(data.message || "Login failed. Please check your credentials.");
        if (data.requiresMFA) {
          setRequiresMFA(false);
        }
      }
    } catch (err: any) {
      setError("Connection error. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-gray-300 bg-white p-8 shadow-lg">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="h-16 w-16 rounded-lg bg-blue-900 flex items-center justify-center shadow-md">
                <span className="text-2xl text-white font-bold">D</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Doctor Portal</h1>
            <p className="mt-2 text-sm text-gray-600">
              {requiresMFA ? "Enter MFA Code" : "Sign in with secure MFA"}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {requiresMFA && (
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              Please enter the 6-digit code from your authenticator app
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!requiresMFA ? (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="mfaCode" className="block text-sm font-semibold text-gray-900 mb-2">
                  MFA Code
                </label>
                <input
                  id="mfaCode"
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20 text-center text-2xl tracking-widest"
                  placeholder="000000"
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-600">
                  Enter the 6-digit code from your authenticator app
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRequiresMFA(false);
                    setMfaCode("");
                  }}
                  className="mt-2 text-sm text-blue-900 hover:text-blue-800"
                >
                  Back to login
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (requiresMFA && mfaCode.length !== 6)}
              className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white shadow-sm transition-all hover:bg-blue-800 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (requiresMFA ? "Verifying..." : "Signing in...") : (requiresMFA ? "Verify MFA" : "Sign In")}
            </button>
          </form>
        </div>
        </div>
    </div>
  );
}
