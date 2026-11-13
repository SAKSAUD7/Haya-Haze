"use client";

/** Browser API client: same-origin (proxied to Django), cookies included, CSRF handled. */

export class ApiError extends Error {
  status: number;
  code?: string;
  fields: Record<string, string>;

  constructor(status: number, message: string, code?: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const BASE = "/api/v1";
const SAFE = new Set(["GET", "HEAD"]);

function cookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

let csrfPromise: Promise<void> | null = null;
async function ensureCsrf(): Promise<string> {
  if (!cookie("csrftoken")) {
    csrfPromise ??= fetch(`${BASE}/auth/csrf/`, { credentials: "include" }).then(() => undefined);
    await csrfPromise;
    csrfPromise = null;
  }
  return cookie("csrftoken");
}

function flatten(value: unknown): string {
  if (Array.isArray(value)) return value.map(flatten).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flatten).join(" ");
  return String(value ?? "");
}

async function toError(response: Response): Promise<ApiError> {
  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    /* not JSON */
  }
  if (response.status === 429) return new ApiError(429, "Too many attempts. Please wait a moment and try again.");
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "detail" && key !== "code" && key !== "non_field_errors") fields[key] = flatten(value);
  }
  const message =
    (typeof data.detail === "string" && data.detail) ||
    flatten(data.non_field_errors) ||
    Object.values(fields)[0] ||
    (response.status >= 500 ? "Something went wrong on our side. Please try again." : "Please check the details and try again.");
  return new ApiError(response.status, message, typeof data.code === "string" ? data.code : undefined, fields);
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
};

let refreshing: Promise<boolean> | null = null;
/** Access tokens are short-lived; swap in a fresh one with the refresh cookie. */
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const csrf = await ensureCsrf();
    const response = await fetch(`${BASE}/auth/token/refresh/`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf }, body: "{}",
    });
    return response.ok;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (!SAFE.has(method)) headers["X-CSRFToken"] = await ensureCsrf();

  let url = `${BASE}${path}`;
  if (options.params) {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== "") q.set(key, String(value));
    }
    const s = q.toString();
    if (s) url += (url.includes("?") ? "&" : "?") + s;
  }

  const response = await fetch(url, { method, headers, body, credentials: "include", signal: options.signal });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return api<T>(path, options, false);
  }
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
