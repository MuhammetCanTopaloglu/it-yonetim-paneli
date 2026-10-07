import type { BlastRadiusResult, Switch, SwitchFormData, SwitchPort } from "../types";

const BASE = "/api/switches";

export class PortRemovalConfirmError extends Error {
  occupiedPorts: SwitchPort[];
  constructor(occupiedPorts: SwitchPort[]) {
    super("Bazı portlarda kayıtlı bağlantılar var, önce onay gerekiyor");
    this.name = "PortRemovalConfirmError";
    this.occupiedPorts = occupiedPorts;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 409 && Array.isArray(body.occupiedPorts)) {
      throw new PortRemovalConfirmError(body.occupiedPorts);
    }
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listSwitches(q?: string): Promise<Switch[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return fetch(`${BASE}${qs}`).then((r) => handle(r));
}

export function createSwitch(data: SwitchFormData, confirmPortRemoval = false): Promise<Switch> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, confirm_port_removal: confirmPortRemoval })
  }).then((r) => handle(r));
}

export function updateSwitch(id: string, data: SwitchFormData, confirmPortRemoval = false): Promise<Switch> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, confirm_port_removal: confirmPortRemoval })
  }).then((r) => handle(r));
}

export function updateSwitchPosition(id: string, pos_x: number, pos_y: number): Promise<void> {
  return fetch(`${BASE}/${id}/position`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pos_x, pos_y })
  }).then((r) => handle(r));
}

export function deleteSwitch(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function getBlastRadius(id: string): Promise<BlastRadiusResult> {
  return fetch(`${BASE}/${id}/blast-radius`).then((r) => handle(r));
}
