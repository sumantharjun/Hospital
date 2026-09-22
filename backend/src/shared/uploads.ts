import fs from "fs";
import path from "path";

/**
 * Single source of truth for where uploaded files live.
 *
 * Several routers previously used the relative multer dest "uploads/reports/",
 * which resolves against the process CWD. That bypassed UPLOAD_DIR entirely, so
 * report files were written outside any mounted disk (lost on restart) and the
 * app crashed with EACCES when the container runs as a non-root user.
 *
 * Point UPLOAD_DIR at a persistent mount in production.
 */
export const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

/** Absolute path to a category directory, created on first use. */
export function uploadDir(category: string): string {
  const dir = path.join(UPLOAD_ROOT, category);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Resolve a stored file reference (absolute path, "/uploads/..." URL, or bare
 * filename) to somewhere under UPLOAD_ROOT.
 *
 * `category` is the fallback directory for bare filenames.
 */
export function resolveUploadPath(stored: string, category: string): string {
  if (path.isAbsolute(stored)) return stored;

  const normalized = stored.replace(/^\/+/, "");
  if (normalized.startsWith("uploads/")) {
    // Strip the leading "uploads/" segment; UPLOAD_ROOT already supplies it.
    return path.join(UPLOAD_ROOT, normalized.slice("uploads/".length));
  }

  return path.join(UPLOAD_ROOT, category, path.basename(stored));
}
