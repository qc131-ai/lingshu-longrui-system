/** 切换为 false 并配置 VITE_API_BASE_URL 即可接入真实后端 */
export const USE_MOCK = true;

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function generateId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).substr(2, 9)}`;
}

export { generateId };
