import type { Player } from "@empire/core";

/** Dirección del servidor. Vacía en desarrollo: Vite reenvía /api al servidor local. */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Target {
  id: string;
  username: string;
  name: string;
  power: number;
  castle: number;
}

type ServerPlayer = Player & { id: string; username: string; serverTime: number };

async function request<T>(method: "GET" | "POST", path: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Error del servidor");
  return data as T;
}

export const api = {
  register: (username: string, password: string, kingdom?: string) =>
    request<{ token: string; player: ServerPlayer }>("POST", "/api/auth/register", undefined, { username, password, kingdom }),
  login: (username: string, password: string) => request<{ token: string; player: ServerPlayer }>("POST", "/api/auth/login", undefined, { username, password }),
  logout: (token: string) => request("POST", "/api/auth/logout", token, {}),
  me: (token: string) => request<{ player: ServerPlayer }>("GET", "/api/me", token),
  targets: (token: string) => request<{ targets: Target[] }>("GET", "/api/me/targets", token),
  post: <T = { player: ServerPlayer }>(token: string, path: string, body: unknown) => request<T & { player: ServerPlayer }>("POST", path, token, body),
};
