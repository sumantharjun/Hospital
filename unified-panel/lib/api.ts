const getApiBase = (): string => {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE;

  if (!apiBase) {
    const isProduction = process.env.NODE_ENV === "production";
    const envFile = isProduction ? "deployment platform" : ".env.local";
    console.error(`NEXT_PUBLIC_API_BASE is not defined. Please check your ${envFile} file.`);
    throw new Error(`API_BASE is not configured. Please set NEXT_PUBLIC_API_BASE in your ${envFile}.`);
  }

  let cleaned = apiBase.trim();
  cleaned = cleaned.replace(/;(?=\/|$)/g, "");
  cleaned = cleaned.replace(/[\/\s]+$/, "");

  return cleaned;
};

export const buildApiUrl = (path: string): string => {
  const base = getApiBase();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`.replace(/([^:]\/)\/+/g, "$1");
};

export const HOSPITALS_PATH = "/api/master/hospitals";
export const PHARMACIES_PATH = "/api/master/pharmacies";

export const NETWORK_ERROR_MESSAGE =
  "Unable to connect to the server. Please check your network connection and try again.";

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    throw new Error("BACKEND_UNREACHABLE");
  }
}

export function doctorsByHospitalPath(hospitalId: string): string {
  return `/api/users?role=DOCTOR&hospitalId=${hospitalId}`;
}

export function availableDoctorsPath(hospitalId: string, dateStr: string): string {
  return `/api/appointments/available-doctors?hospitalId=${hospitalId}&date=${dateStr}`;
}
