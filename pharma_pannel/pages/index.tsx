import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { userApi } from "@/services/api";
import { setAuth } from "@/utils/auth";

type LoginMode = "password" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (loginMode === "password") {
        const data = await userApi.login(emailOrPhone, password);
        const isPharmacyStaff = data.user.role === "PHARMACY_STAFF";
        if (!isPharmacyStaff) {
          throw new Error("Access denied. This portal is for pharmacy staff only.");
        }
        setAuth(data.token, data.user);
      } else {
        if (!otpSent) {
          await userApi.sendOtp(phone);
          setOtpSent(true);
          toast.success("OTP sent! Check your phone (in dev, check server console).");
        } else {
          const data = await userApi.verifyOtp(phone, otp);
          const isPharmacyStaff = data.user.role === "PHARMACY_STAFF";
          if (!isPharmacyStaff) {
            throw new Error("Access denied. This portal is for pharmacy staff only.");
          }
          setAuth(data.token, data.user);
        }
      }
      if (loginMode === "password" || otpSent) {
        toast.success("Login successful!");
        setTimeout(() => router.push("/dashboard"), 100);
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
            scale: [1, 1.3, 1],
            rotate: [90, 180, 90],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute bottom-20 right-20 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200 p-8 sm:p-10">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-green-600 mb-4 shadow-lg"
            >
              <span className="text-4xl">💊</span>
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pharmacy Portal</h1>
            <p className="text-gray-600">Sign in to manage your pharmacy</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            >
              {error}
            </motion.div>
          )}

          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => { setLoginMode("password"); setOtpSent(false); setError(null); setEmailOrPhone(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${loginMode === "password" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode("otp"); setOtpSent(false); setError(null); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${loginMode === "otp" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
            >
              Phone + OTP
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {loginMode === "password" ? (
              <>
                <div>
                  <label htmlFor="emailOrPhone" className="block text-sm font-semibold text-gray-700 mb-2">Email or Mobile Number</label>
                  <input
                    id="emailOrPhone"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-gray-900"
                    placeholder="Email or 10-digit mobile number"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-10 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-gray-900"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={otpSent}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-gray-900 disabled:bg-gray-100"
                    placeholder="10-digit mobile number"
                  />
                </div>
                {otpSent && (
                  <div>
                    <label htmlFor="otp" className="block text-sm font-semibold text-gray-700 mb-2">Enter OTP</label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      required
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-gray-900 text-center text-lg tracking-widest"
                      placeholder="000000"
                    />
                  </div>
                )}
              </>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Please wait..." : loginMode === "otp" && !otpSent ? "Send OTP" : loginMode === "otp" && otpSent ? "Verify & Sign In" : "Sign In"}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
