const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export const buildApiUrl = (path) => {
  const base = API_BASE.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

export const getAuthHeaders = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiFetch = async (url, options = {}) => {
  try {
    return await fetch(url, options);
  } catch (err) {
    throw new Error("Cannot connect to server. Please check your network.");
  }
};
