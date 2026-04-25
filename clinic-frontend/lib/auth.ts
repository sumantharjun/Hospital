const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

export function saveSession(token: string, user: Record<string, any>) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  // Cookies for middleware route protection
  document.cookie = `clinic_token=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  document.cookie = `clinic_role=${user.role}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  // Clear legacy receptionist keys too
  localStorage.removeItem("recption_token");
  localStorage.removeItem("recption_user");
  document.cookie = "clinic_token=; path=/; max-age=0";
  document.cookie = "clinic_role=; path=/; max-age=0";
}

export function getStoredUser<T = Record<string, any>>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function isAdmin(role?: string): boolean {
  return role === "SUPER_ADMIN" || role === "HOSPITAL_ADMIN";
}

export function isReceptionist(role?: string): boolean {
  return role === "RECEPTIONIST" || role === "HOSPITAL_ADMIN" || role === "SUPER_ADMIN";
}

export function dashboardPathForRole(role: string): string {
  if (role === "SUPER_ADMIN") return "/admin/dashboard";
  if (role === "HOSPITAL_ADMIN" || role === "RECEPTIONIST") return "/reception/dashboard";
  return "/";
}
