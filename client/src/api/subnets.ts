import type { Subnet, SubnetFormData, SubnetPool } from "../types";

const BASE = "/api/subnets";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listSubnets(q?: string): Promise<Subnet[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return fetch(`${BASE}${qs}`).then((r) => handle(r));
}

export function createSubnet(data: SubnetFormData): Promise<Subnet> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function updateSubnet(id: string, data: SubnetFormData): Promise<Subnet> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteSubnet(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function getSubnetPool(id: string, limit = 10): Promise<SubnetPool> {
  return fetch(`${BASE}/${id}/pool?limit=${limit}`).then((r) => handle(r));
}
