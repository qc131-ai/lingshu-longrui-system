export type ApiStatus = "idle" | "loading" | "success" | "error";

export type ApiCallState<T = unknown> = {
  status: ApiStatus;
  loading: boolean;
  error: string | null;
  data?: T;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiClientError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
let lastErrorAt = 0;

function emitApiError(message: string) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastErrorAt < 1500) return;
  lastErrorAt = now;
  window.dispatchEvent(new CustomEvent("api-error", { detail: { message } }));
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getAuthHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("astralink.auth.token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function createApiCallState<T>(): ApiCallState<T> {
  return { status: "idle", loading: false, error: null };
}

export function setApiLoading<T>(state: ApiCallState<T>) {
  state.status = "loading";
  state.loading = true;
  state.error = null;
}

export function setApiSuccess<T>(state: ApiCallState<T>, data?: T) {
  state.status = "success";
  state.loading = false;
  state.error = null;
  state.data = data;
}

export function setApiError<T>(state: ApiCallState<T>, error: string) {
  state.status = "error";
  state.loading = false;
  state.error = error;
}

export const apiClient = {
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(buildUrl(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...options.headers,
      },
    });

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;

    if (!response.ok) {
      const envelope = payload as ApiEnvelope<T> | null;
      throw new ApiClientError(
        envelope?.error?.message ?? `API request failed: ${response.status}`,
        response.status,
        envelope?.error?.code
      );
    }

    if (payload && typeof payload === "object" && "success" in payload) {
      const envelope = payload as ApiEnvelope<T>;
      if (!envelope.success) {
        throw new ApiClientError(envelope.error?.message ?? "API request failed", response.status, envelope.error?.code);
      }
      return envelope.data as T;
    }

    return payload as T;
  },

  async requestWithFallback<T>(
    path: string,
    options: RequestInit,
    fallback: () => T | Promise<T>,
    state?: ApiCallState<T>
  ): Promise<T> {
    setApiLoading(state ?? createApiCallState<T>());
    try {
      const data = await apiClient.request<T>(path, options);
      if (state) setApiSuccess(state, data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "API request failed";
      if (state) setApiError(state, message);
      emitApiError(`后端接口请求失败，已切换到本地 mock 数据：${message}`);
      return fallback();
    }
  },
};
