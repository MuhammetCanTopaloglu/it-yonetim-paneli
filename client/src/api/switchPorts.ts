import type { SwitchPort, SwitchPortFormData } from "../types";

const BASE = "/api/switch-ports";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  return res.json();
}

export function listSwitchPorts(switchId: string): Promise<SwitchPort[]> {
  return fetch(`${BASE}?switch_id=${switchId}`).then((r) => handle(r));
}

export interface UpdatePortResult {
  port: SwitchPort;
  warning: string | null;
}

export function updateSwitchPort(id: string, data: SwitchPortFormData): Promise<UpdatePortResult> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}
