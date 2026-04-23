// API utility with automatic error handling
const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const url = `${API_BASE}${endpoint}`;
    console.log(`[API] ${options.method || "GET"} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    }).catch((fetchError: any) => {
      // Network error - backend not reachable
      console.error("[API] Fetch failed:", fetchError);
      const networkError = new Error("Unable to connect to server. Please ensure the backend is running on http://localhost:4000");
      (networkError as any).isNetworkError = true;
      (networkError as any).originalError = fetchError;
      throw networkError;
    });

    console.log(`[API] Response status: ${response.status} for ${url}`);

    // Handle authentication errors
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.message && (errorData.message.includes("Authentication") || errorData.message.includes("token") || errorData.message.includes("Unauthorized"))) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/";
        }
        throw new Error("Authentication failed");
      }
      throw new Error(errorData.message || "Unauthorized");
    }

    return response;
  } catch (error: any) {
    if (error.message === "Authentication failed") {
      throw error;
    }
    
    // Re-throw network errors (already handled above)
    if (error.isNetworkError) {
      throw error;
    }
    
    // Handle other fetch errors
    if (error.name === "TypeError" || error.message === "Failed to fetch" || error.message?.includes("fetch")) {
      const networkError = new Error("Unable to connect to server. Please ensure the backend is running on http://localhost:4000");
      (networkError as any).isNetworkError = true;
      throw networkError;
    }
    
    console.error("[API] Error:", error);
    throw error;
  }
}

export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint, { method: "GET" });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).message || `Failed to fetch: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiPost<T = unknown>(endpoint: string, data: unknown): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).message || `Failed to post: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiPut<T = unknown>(endpoint: string, data: unknown): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).message || `Failed to update: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiPatch<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).message || `Failed to patch: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint, { method: "DELETE" });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).message || `Failed to delete: ${response.status}`);
  }
  return response.json() as Promise<T>;
}


