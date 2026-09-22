export const PORT = process.env.PORT || 4000;

// MongoDB connection URI from environment variables
export const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environment variables. Please check your .env file.");
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const DEV_JWT_SECRET = "dev_secret_change_me";

if (IS_PRODUCTION && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET)) {
  // Without this guard a missing JWT_SECRET silently falls back to a public constant,
  // letting anyone forge a SUPER_ADMIN token.
  throw new Error(
    "JWT_SECRET must be set to a strong unique value in production. Generate one with: openssl rand -base64 48"
  );
}

export const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;

/**
 * Browser origins permitted to call the API with credentials.
 * Comma-separated, e.g. "https://admin.example.com,https://doctor.example.com".
 * In non-production, any localhost origin is additionally allowed.
 */
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (IS_PRODUCTION && ALLOWED_ORIGINS.length === 0) {
  throw new Error(
    "ALLOWED_ORIGINS must list the panel origins in production, e.g. https://admin.example.com,https://doctor.example.com"
  );
}

export function isOriginAllowed(origin: string | undefined): boolean {
  // Requests without an Origin header (server-to-server, curl, mobile) are not
  // subject to browser credential rules.
  if (!origin) return true;

  const normalized = origin.replace(/\/+$/, "");
  if (ALLOWED_ORIGINS.includes(normalized)) return true;

  if (!IS_PRODUCTION) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
  }

  return false;
}
