import type { SwitchLink } from "../types";

const BASE = "/api/switch-links";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listSwitchLinks(): Promise<SwitchLink[]> {
  return fetch(BASE).then((r) => handle(r));
}

export function createSwitchLink(
  source_id: string,
  target_id: string,
  label?: string | null
): Promise<SwitchLink> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_id, target_id, label: label ?? null })
  }).then((r) => handle(r));
}

export function updateSwitchLinkLabel(id: string, label: string | null): Promise<SwitchLink> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label })
  }).then((r) => handle(r));
}

export function deleteSwitchLink(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}
