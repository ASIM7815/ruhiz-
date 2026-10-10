"use client";

import { mutate } from "swr";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** JSON fetch against our own API. Cookies are sent automatically; nothing secret lives here. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "You appear to be offline. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) {
      window.location.href = `/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiError(res.status, data?.error ?? "Something went wrong. Please try again.", data?.code);
  }
  return data as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);

/** Revalidates every cached SWR key that starts with one of the given prefixes. */
export function revalidate(...prefixes: string[]) {
  return mutate((key) => {
    const k = Array.isArray(key) ? String(key[0]) : typeof key === "string" ? key : "";
    return prefixes.some((p) => k.startsWith(p));
  });
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");
