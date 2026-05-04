const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("lab_token") ?? "";
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`, { headers: authHeaders() }).then((r) => handleResponse<T>(r));
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) }).then((r) => handleResponse<T>(r));
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) }).then((r) => handleResponse<T>(r));
}

export function apiDelete<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`, { method: "DELETE", headers: authHeaders() }).then((r) => handleResponse<T>(r));
}

export async function apiDownloadPdf(path: string): Promise<void> {
  const token = getToken();
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? "Failed to generate report");
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = `report-${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(objUrl);
}
