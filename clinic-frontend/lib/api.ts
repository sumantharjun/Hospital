const getApiBase = (): string => {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE;
  if (!apiBase) {
    if (typeof window !== "undefined") {
      console.error("NEXT_PUBLIC_API_BASE is not set. Add it to .env.local (e.g. http://localhost:4000)");
    }
    return "";
  }
  return apiBase.trim().replace(/[/\s]+$/, "");
};

// Used by pages that call buildApiUrl
export const buildApiUrl = (path: string): string => {
  const base = getApiBase();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`.replace(/([^:]\/)\/+/g, "$1");
};

// Used by pages that construct URLs directly with template literals
export const API_BASE = (() => {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_API_BASE || "";
  return (process.env.NEXT_PUBLIC_API_BASE || "").trim().replace(/[/\s]+$/, "");
})();

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (e: any) {
    if (e?.name === "TypeError") {
      const err = new Error("BACKEND_UNREACHABLE");
      (err as any).cause = e;
      throw err;
    }
    throw e;
  }
}

export const NETWORK_ERROR_MESSAGE =
  "Backend unreachable. Ensure NEXT_PUBLIC_API_BASE is set in .env.local and the backend server is running.";

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Paths used by receptionist panel
export const HOSPITALS_PATH = "/api/master/hospitals";
export const PHARMACIES_PATH = "/api/master/pharmacies";

export function doctorsByHospitalPath(hospitalId?: string) {
  if (!hospitalId) return "/api/users?role=DOCTOR";
  return `/api/users?role=DOCTOR&hospitalId=${encodeURIComponent(hospitalId)}`;
}

export function availableDoctorsPath(hospitalId?: string, dateStr?: string) {
  const params = new URLSearchParams();
  if (hospitalId) params.set("hospitalId", hospitalId);
  if (dateStr) params.set("date", dateStr);
  return `/api/doctors/available?${params}`;
}
