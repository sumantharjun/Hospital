import crypto from "crypto";

/**
 * Shared OTP issuing/verification.
 *
 * Replaces the previously hardcoded "1234" / "123456" test codes, which allowed
 * anyone to mint a valid session for any phone number.
 *
 * Codes are random, single-use, attempt-limited and hashed at rest. Delivery goes
 * through TextLocal when configured; when no SMS provider is configured the code is
 * only obtainable out-of-band (server log), and only outside production.
 */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

interface OtpEntry {
  hash: string;
  expiresAt: number;
  attempts: number;
}

// NOTE: in-memory, so this only works with a single backend instance.
// Move to Redis before scaling the backend horizontally.
const otpStore = new Map<string, OtpEntry>();

export function normalizePhone(phone: unknown): string {
  return phone ? String(phone).replace(/\D/g, "").slice(-10) : "";
}

function hash(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
  // crypto.randomInt is uniform, unlike Math.random() based digit generation
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.TEXT_LOCAL_API_KEY);
}

/** True when a code may be surfaced via server logs instead of SMS. Never in production. */
export function devOtpAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_OTP === "true";
}

async function deliverOtp(phone: string, otp: string): Promise<boolean> {
  if (!isSmsConfigured()) {
    if (devOtpAllowed()) {
      console.log(`[DEV OTP] ${phone} -> ${otp} (ALLOW_DEV_OTP=true, non-production only)`);
      return true;
    }
    console.error("OTP requested but TEXT_LOCAL_API_KEY is not configured; refusing to issue a code.");
    return false;
  }

  try {
    const response = await fetch("https://api.textlocal.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: process.env.TEXT_LOCAL_API_KEY,
        numbers: phone,
        message: `Your verification code is ${otp}. It expires in 10 minutes.`,
        sender: process.env.TEXT_LOCAL_SENDER || "TXTLCL",
      }),
    });
    const data: any = await response.json();
    if (data?.status !== "success") {
      console.error("OTP SMS delivery failed:", data?.errors ?? data);
      return false;
    }
    return true;
  } catch (error) {
    console.error("OTP SMS delivery threw:", error);
    return false;
  }
}

/**
 * Issue a code for `phone`. Returns false when delivery is not possible, so callers
 * can fail loudly rather than leaving the user stuck on a code that never arrives.
 */
export async function issueOtp(phone: string): Promise<boolean> {
  const otp = generateOtp();
  const delivered = await deliverOtp(phone, otp);
  if (!delivered) return false;

  otpStore.set(phone, {
    hash: hash(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return true;
}

export type OtpResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

/** Verify and consume a code. A code is always consumed on success and never reusable. */
export function verifyOtp(phone: string, otp: unknown): OtpResult {
  const candidate = otp != null ? String(otp).trim() : "";
  if (!candidate) {
    return { ok: false, status: 400, message: "OTP is required" };
  }

  const entry = otpStore.get(phone);
  if (!entry) {
    return { ok: false, status: 400, message: "No OTP was sent to this number. Please request a new one." };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return { ok: false, status: 400, message: "OTP expired. Please request a new one." };
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { ok: false, status: 429, message: "Too many incorrect attempts. Please request a new OTP." };
  }

  const expected = Buffer.from(entry.hash);
  const actual = Buffer.from(hash(candidate));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return { ok: false, status: 401, message: "Invalid OTP" };
  }

  otpStore.delete(phone);
  return { ok: true };
}

export const OTP_EXPIRES_IN_SECONDS = OTP_TTL_MS / 1000;
