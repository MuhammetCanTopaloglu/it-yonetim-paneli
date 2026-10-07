import type { PingCheckResult } from "../types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  return res.json();
}

export function runPingCheck(): Promise<PingCheckResult> {
  return fetch("/api/ping/check", { method: "POST" }).then((r) => handle(r));
}
