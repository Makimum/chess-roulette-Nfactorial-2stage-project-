// Auth API + JWT session storage.
//
// Reads VITE_API_BASE_URL directly. Does NOT import from ./api to avoid
// circular dependencies (api.ts imports getAuthToken / refreshAccessToken /
// clearAuthSession from here).

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export const ACCESS_TOKEN_KEY = "cma_access_token";
export const REFRESH_TOKEN_KEY = "cma_refresh_token";
export const USER_KEY = "cma_user";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

// ---- Types ---------------------------------------------------------------

export interface AuthUser {
  id: string; // UUID
  email: string | null;
  username: string;
  countryCode: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  /** Relative path like "/api/users/<uuid>/photo" or null. Use resolvePhotoUrl(). */
  photoUrl: string | null;
}

/** Resolve a backend-relative photoUrl to an absolute URL for <img src>. */
export function resolvePhotoUrl(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  if (!BASE_URL) return photoUrl;
  return `${BASE_URL}${photoUrl.startsWith("/") ? "" : "/"}${photoUrl}`;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokenType?: "bearer";
  expiresIn?: number;
}

export interface AccessTokenResponse {
  accessToken: string;
  tokenType?: "bearer";
  expiresIn?: number;
}

export type ValidationIssue = {
  type?: string;
  loc?: Array<string | number>;
  msg?: string;
  input?: unknown;
};

export class AuthError extends Error {
  status: number;
  /** Per-field validation errors derived from a FastAPI 422 detail array. */
  fieldErrors: Record<string, string>;
  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.name = "AuthError";
    this.fieldErrors = fieldErrors;
  }
}

// ---- Storage helpers -----------------------------------------------------

export function getAuthToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Persist the full session after signup or login. */
export function setAuthSession(res: AuthResponse): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(res.user));
}

/** Update only the access token (after /api/auth/refresh). */
export function setAccessToken(accessToken: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function setStoredUser(user: AuthUser): void {
  if (!isBrowser()) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ---- Internal HTTP -------------------------------------------------------

function parseDetail(body: unknown, fallback: string): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return { message: d, fieldErrors };
    if (Array.isArray(d)) {
      const msgs: string[] = [];
      for (const it of d as ValidationIssue[]) {
        const msg = it?.msg ?? "Validation error";
        msgs.push(msg);
        const loc = it?.loc;
        if (Array.isArray(loc) && loc.length) {
          // FastAPI loc is e.g. ["body", "username"] — take the last segment
          const key = String(loc[loc.length - 1]);
          if (key && !fieldErrors[key]) fieldErrors[key] = msg;
        }
      }
      return { message: msgs.join("; "), fieldErrors };
    }
    if (d != null) return { message: String(d), fieldErrors };
  }
  if (typeof body === "string" && body) return { message: body, fieldErrors };
  return { message: fallback, fieldErrors };
}

async function authHttp<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  if (!BASE_URL) {
    throw new AuthError("VITE_API_BASE_URL is not set.", 0);
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (init.auth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new AuthError(`Cannot reach backend: ${msg}`, 0);
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const { message, fieldErrors } = parseDetail(body, `Request failed (${res.status})`);
    throw new AuthError(message, res.status, fieldErrors);
  }
  return body as T;
}

// ---- Public API ----------------------------------------------------------

export interface SendCodeResponse {
  success: true;
  expiresIn: number;
  resendAfter: number;
}

export interface SuccessResponse {
  success: true;
}

// ---- Signup (two-step with email code) -----------------------------------

export async function sendSignupCode(input: {
  email: string;
  username: string;
}): Promise<SendCodeResponse> {
  return authHttp<SendCodeResponse>("/api/auth/signup/send-code", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim(),
      username: input.username.trim(),
    }),
  });
}

export async function confirmSignup(input: {
  email: string;
  username: string;
  password: string;
  code: string;
}): Promise<AuthResponse> {
  const res = await authHttp<AuthResponse>("/api/auth/signup/confirm", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim(),
      username: input.username.trim(),
      password: input.password,
      code: input.code.trim(),
    }),
  });
  setAuthSession(res);
  return res;
}

// ---- Login (email OR username via `identifier`) --------------------------

export async function login(input: {
  identifier: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await authHttp<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      identifier: input.identifier.trim(),
      password: input.password,
    }),
  });
  setAuthSession(res);
  return res;
}

// ---- Password reset ------------------------------------------------------

export async function sendPasswordResetCode(input: {
  identifier: string;
}): Promise<SendCodeResponse> {
  return authHttp<SendCodeResponse>("/api/auth/password-reset/send-code", {
    method: "POST",
    body: JSON.stringify({ identifier: input.identifier.trim() }),
  });
}

export async function confirmPasswordReset(input: {
  identifier: string;
  code: string;
  newPassword: string;
}): Promise<SuccessResponse> {
  return authHttp<SuccessResponse>("/api/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({
      identifier: input.identifier.trim(),
      code: input.code.trim(),
      newPassword: input.newPassword,
    }),
  });
}

// ---- Email change (protected) -------------------------------------------

export async function sendEmailChangeCode(input: {
  newEmail: string;
  currentPassword: string;
}): Promise<SendCodeResponse> {
  return authHttp<SendCodeResponse>("/api/auth/email-change/send-code", {
    auth: true,
    method: "POST",
    body: JSON.stringify({
      newEmail: input.newEmail.trim(),
      currentPassword: input.currentPassword,
    }),
  });
}

export async function confirmEmailChange(input: {
  newEmail: string;
  code: string;
}): Promise<AuthUser> {
  const user = await authHttp<AuthUser>("/api/auth/email-change/confirm", {
    auth: true,
    method: "POST",
    body: JSON.stringify({
      newEmail: input.newEmail.trim(),
      code: input.code.trim(),
    }),
  });
  setStoredUser(user);
  return user;
}

// ---- Password change (protected) ----------------------------------------

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<SuccessResponse> {
  return authHttp<SuccessResponse>("/api/auth/password/change", {
    auth: true,
    method: "POST",
    body: JSON.stringify({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    }),
  });
}

// ---- Common ---------------------------------------------------------------

export async function getMe(): Promise<AuthUser> {
  const user = await authHttp<AuthUser>("/api/auth/me", { auth: true });
  setStoredUser(user);
  return user;
}

// Refresh-in-flight guard: only one /api/auth/refresh in flight at a time.
let refreshInFlight: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);
  refreshInFlight = (async () => {
    try {
      const res = await authHttp<AccessTokenResponse>("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
      setAccessToken(res.accessToken);
      return res.accessToken;
    } catch {
      clearAuthSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function logoutRequest(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return;
  try {
    await authHttp<unknown>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // ignore — we clear local session regardless
  }
}

// ---- Profile photo (protected) ------------------------------------------

async function photoHttp(method: "POST" | "DELETE", body?: FormData): Promise<AuthUser> {
  if (!BASE_URL) {
    throw new AuthError("VITE_API_BASE_URL is not set.", 0);
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // NOTE: do NOT set Content-Type for FormData — browser sets boundary itself.

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/users/me/photo`, { method, headers, body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new AuthError(`Cannot reach backend: ${msg}`, 0);
  }
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }
  if (!res.ok) {
    const fieldErrors: Record<string, string> = {};
    let message = `Request failed (${res.status})`;
    if (parsed && typeof parsed === "object" && "detail" in parsed) {
      const d = (parsed as { detail: unknown }).detail;
      if (typeof d === "string") message = d;
      else if (d != null) message = String(d);
    } else if (typeof parsed === "string" && parsed) {
      message = parsed;
    }
    throw new AuthError(message, res.status, fieldErrors);
  }
  const user = parsed as AuthUser;
  setStoredUser(user);
  return user;
}

export async function uploadProfilePhoto(file: File): Promise<AuthUser> {
  const form = new FormData();
  form.append("photo", file);
  return photoHttp("POST", form);
}

export async function deleteProfilePhoto(): Promise<AuthUser> {
  return photoHttp("DELETE");
}
