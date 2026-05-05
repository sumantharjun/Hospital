import { useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { buildApiUrl } from "../lib/api";

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
        body: JSON.stringify({
          name,
          email,
          password,
          role: "SUPER_ADMIN",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Signup failed");
      }
      // On success, redirect to login
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 px-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute bottom-20 right-20 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 lg:p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-600 to-green-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg mx-auto mb-4">
              HP
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-black mb-2">
          Create Super Admin
        </h1>
            <p className="text-gray-600 text-xs sm:text-sm">
          This account will have full control over hospitals, pharmacies, doctors and finance.
        </p>
          </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
              <label className="block text-sm font-medium text-black mb-1">
              Name
            </label>
            <input
              type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
              <label className="block text-sm font-medium text-black mb-1">
              Email
            </label>
            <input
              type="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
              <label className="block text-sm font-medium text-black mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none cursor-pointer"
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
          {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2.5 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
          <p className="mt-4 text-xs text-gray-600 text-center">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => router.push("/")}
              className="text-blue-600 hover:text-blue-700 underline font-medium transition-colors cursor-pointer"
          >
            Go to login
          </button>
        </p>
      </div>
      </motion.div>
    </div>
  );
}


