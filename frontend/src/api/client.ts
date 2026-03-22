// AgenticMeadows — Base API client
// Handles auth token injection and error normalization

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const AI_BASE = import.meta.env.VITE_AI_BASE_URL ?? "";

function getToken(): string | null {
  return localStorage.getItem("am_token");
}

export function getAuthToken(): string | null {
  return getToken();
}

async function apiFetch<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string>),
  };

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error ?? json.message ?? text;
    } catch {
      // keep raw text
    }
    throw new Error(message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiFetch<T>(API_BASE, path, init);
}

export function aiApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiFetch<T>(AI_BASE, path, init);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete(path: string): Promise<void> {
  return api<void>(path, { method: "DELETE" });
}
