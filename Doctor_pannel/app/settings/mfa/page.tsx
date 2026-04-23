"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";

export default function MFASetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"setup" | "verify" | "enabled">("setup");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, [router]);

  const handleSetup = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const data = await apiPost<{
        secret: string;
        qrCode: string;
        backupCodes: string[];
      }>("/api/users/mfa/setup", {});
      
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep("verify");
    } catch (error: any) {
      alert("Failed to setup MFA: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!token || !verificationCode) return;
    
    setLoading(true);
    try {
      await apiPost("/api/users/mfa/verify", {
        code: verificationCode,
      });
      
      setStep("enabled");
      alert("MFA enabled successfully! Please save your backup codes.");
    } catch (error: any) {
      alert("Failed to verify MFA: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-300 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">MFA Setup</h1>
              <p className="mt-1 text-sm text-gray-600">Enable two-factor authentication for secure login</p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {step === "setup" && (
          <div className="rounded-lg border border-gray-300 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Enable Multi-Factor Authentication</h2>
            <p className="text-gray-700 mb-6">
              MFA adds an extra layer of security to your account. You'll need to enter a code from your authenticator app when logging in.
            </p>
            <button
              onClick={handleSetup}
              disabled={loading}
              className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "Setting up..." : "Setup MFA"}
            </button>
          </div>
        )}

        {step === "verify" && (
          <div className="rounded-lg border border-gray-300 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Scan QR Code</h2>
            <div className="mb-6 text-center">
              {qrCode && (
                <div className="inline-block p-4 bg-white border-2 border-gray-300 rounded-lg">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                </div>
              )}
            </div>
            <p className="text-gray-700 mb-4">
              1. Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <p className="text-gray-700 mb-4">
              2. Enter the 6-digit code from your app to verify
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm text-center text-2xl tracking-widest"
                placeholder="000000"
                autoFocus
              />
            </div>

            {backupCodes.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Backup Codes (Save these!)</h3>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, idx) => (
                    <code key={idx} className="text-sm font-mono bg-white p-2 rounded border">
                      {code}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Save these codes in a safe place. You can use them if you lose access to your authenticator app.
                </p>
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={loading || verificationCode.length !== 6}
              className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Enable MFA"}
            </button>
          </div>
        )}

        {step === "enabled" && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-8 shadow-sm text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">MFA Enabled Successfully!</h2>
            <p className="text-gray-700 mb-6">
              Your account is now protected with multi-factor authentication.
            </p>
            {backupCodes.length > 0 && (
              <div className="mb-6 p-4 bg-white border border-gray-300 rounded-lg text-left">
                <h3 className="font-semibold text-gray-900 mb-2">Your Backup Codes</h3>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, idx) => (
                    <code key={idx} className="text-sm font-mono bg-gray-50 p-2 rounded border">
                      {code}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  ⚠️ Save these codes now! You won't be able to see them again.
                </p>
              </div>
            )}
            <Link
              href="/dashboard"
              className="inline-block rounded-lg bg-blue-900 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

