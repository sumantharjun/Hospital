import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { buildApiUrl } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check if email belongs to admin when email changes
  const checkEmailRole = async (emailValue: string) => {
    if (!emailValue || !emailValue.includes("@")) {
      setIsAdminLogin(false);
      return;
    }
    setCheckingRole(true);
    try {
      const res = await fetch(buildApiUrl(`/api/users/check-role/${encodeURIComponent(emailValue)}`));
      if (res.ok) {
        const data = await res.json();
        setIsAdminLogin(data.isAdmin && data.exists && data.isActive);
      }
    } catch (err) {
      // Silently fail - just don't show admin login
      setIsAdminLogin(false);
    } finally {
      setCheckingRole(false);
    }
  };

  // Use useEffect for debouncing email role check
  useEffect(() => {
    if (!email || !email.includes("@")) {
      setIsAdminLogin(false);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      checkEmailRole(email);
    }, 500);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Login failed");
      }
      const data = await res.json();
      
      // Check if user is admin/super admin
      const isAdmin = data.user.role === "SUPER_ADMIN" || data.user.role === "HOSPITAL_ADMIN";
      
      if (typeof window !== "undefined") {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      
      toast.success("Login successful!");
      
      // Redirect based on role
      if (isAdmin) {
        router.push("/dashboard");
      } else {
        
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 relative overflow-hidden">
      <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[9999] pointer-events-none">
        <div className="max-w-sm sm:max-w-none ml-auto">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#fff",
            color: "#000",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            padding: "12px 16px",
            fontSize: "14px",
            fontWeight: "500",
                maxWidth: "calc(100vw - 2rem)",
                pointerEvents: "auto",
          },
          success: {
            iconTheme: {
              primary: "#00A86B",
              secondary: "#fff",
            },
            style: {
              borderLeft: "4px solid #00A86B",
            },
          },
          error: {
            iconTheme: {
              primary: "#DC3545",
              secondary: "#fff",
            },
            style: {
              borderLeft: "4px solid #DC3545",
            },
          },
        }}
      />
        </div>
      </div>
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
        className="w-full max-w-md relative z-10 px-4 sm:px-0"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6 sm:mb-8"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="inline-block mb-4"
          >
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-gradient-to-br from-blue-600 to-green-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-2xl shadow-blue-500/50 mx-auto">
              HP
            </div>
          </motion.div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 text-black">
            Hospital Platform
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {isAdminLogin ? "Admin Login Portal" : "Login Portal"}
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 lg:p-8 border border-gray-200"
        >
          <h2 className="text-2xl font-semibold text-black mb-2">Welcome Back</h2>
          <p className="text-sm text-gray-600 mb-6">
            Sign in to manage hospitals, pharmacies, doctors, inventory and finance.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-sm font-medium text-black mb-2">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
              />
              {checkingRole && (
                <p className="text-xs text-gray-600 mt-1">Checking access...</p>
              )}
              {isAdminLogin && !checkingRole && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <p className="text-xs text-blue-700 font-medium">
                    🔐 Admin Access Detected - You have administrative privileges
                  </p>
                </motion.div>
              )}
            </motion.div>
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-sm font-medium text-black mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
            </motion.div>
            {error && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg"
              >
                {error}
              </motion.div>
            )}
            <motion.button
              type="submit"
              disabled={loading || checkingRole}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full rounded-lg px-4 py-2.5 font-semibold text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-all ${
                isAdminLogin 
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg" 
                  : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                  Signing in...
                </span>
              ) : isAdminLogin ? (
                "🔐 Admin Login"
              ) : (
                "Sign in"
              )}
            </motion.button>
          </form>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-xs text-gray-600 text-center"
          >
            First time here?{" "}
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="text-green-600 hover:text-green-700 underline font-medium transition-colors cursor-pointer"
            >
              Create Super Admin account
            </button>{" "}
            to log in.
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
