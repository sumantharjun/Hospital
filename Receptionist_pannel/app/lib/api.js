function getApiBase() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE;
  if (!apiBase) {
    if (typeof window !== "undefined") {
      console.error("NEXT_PUBLIC_API_BASE is not set. Add it to .env.local (e.g. http://localhost:4000)");
    }
    return "";
  }
  let cleaned = apiBase.trim().replace(/[\/\s]+$/, "");
  return cleaned;
}

export function buildApiUrl(path) {
  const base = getApiBase();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`.replace(/([^:]\/)\/+/g, "$1");
}

/** Use when calling the backend. Catches "Failed to fetch" (network/CORS) and throws a clear error. */
export async function apiFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (e) {
    if (e?.name === "TypeError" && (e?.message === "Failed to fetch" || e?.message?.includes("fetch"))) {
      const err = new Error("BACKEND_UNREACHABLE");
      err.cause = e;
      throw err;
    }
    throw e;
  }
}

export const NETWORK_ERROR_MESSAGE =
  "Backend unreachable. Set NEXT_PUBLIC_API_BASE in .env.local (e.g. http://localhost:4000) and ensure the backend server is running.";

export function getAuthHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("recption_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Hospitals (multi-hospital support). Fallback: GET /api/hospitals */
export const HOSPITALS_PATH = "/api/master/hospitals";

/** Pharmacies for send-to-pharmacy */
export const PHARMACIES_PATH = "/api/master/pharmacies";

/** Doctors by hospital: GET /api/users?role=DOCTOR&hospitalId=xyz or /api/doctors?hospitalId=xyz */
export function doctorsByHospitalPath(hospitalId) {
  if (!hospitalId) return "/api/users?role=DOCTOR";
  return `/api/users?role=DOCTOR&hospitalId=${encodeURIComponent(hospitalId)}`;
}

/** Available doctors for date (backend may implement): GET /api/doctors/available?hospitalId=&date= */
export function availableDoctorsPath(hospitalId, dateStr) {
  const params = new URLSearchParams();
  if (hospitalId) params.set("hospitalId", hospitalId);
  if (dateStr) params.set("date", dateStr);
  return `/api/doctors/available?${params}`;
}
