/**
 * Thin fetch wrapper. Every call is namespaced under /api, matches the
 * backend's router prefixes, and automatically attaches the bearer token
 * when present in localStorage.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const TOKEN_KEY = 'foundation.accessToken';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface ApiError extends Error {
  status: number;
  detail: unknown;
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  const raw = await res.text();
  const body = raw ? safeJson(raw) : null;

  if (!res.ok) {
    const err = new Error(
      (body && (body.detail?.[0]?.msg ?? body.detail)) ||
        `Request failed: ${res.status}`
    ) as ApiError;
    err.status = res.status;
    err.detail = body;
    throw err;
  }
  return body as T;
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ── Auth endpoints ────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'provider' | 'admin';
  isActive: boolean;
}

export interface TokenResponse {
  accessToken: string;
  user: User;
}

export const authApi = {
  register: (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: 'user' | 'provider';
  }) => request<TokenResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  login: (payload: { email: string; password: string }) =>
    request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => request<User>('/api/users/me'),
};
