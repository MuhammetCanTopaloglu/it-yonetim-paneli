import type { DashboardData } from "../types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  return res.json();
}

export function getDashboard(): Promise<DashboardData> {
  return fetch("/api/dashboard").then((r) => handle(r));
}
