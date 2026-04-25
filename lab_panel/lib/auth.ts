import type { AuthUser } from "./types";

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("lab_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lab_token");
}

export function saveAuth(token: string, user: AuthUser): void {
  localStorage.setItem("lab_token", token);
  localStorage.setItem("lab_user", JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem("lab_token");
  localStorage.removeItem("lab_user");
}

export function isLabRole(role: string): role is "LAB_ADMIN" | "LAB_OPERATOR" {
  return role === "LAB_ADMIN" || role === "LAB_OPERATOR";
}
