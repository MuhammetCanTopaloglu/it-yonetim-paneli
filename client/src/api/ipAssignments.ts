import type { IpAssignment, IpAssignmentFormData } from "../types";

const BASE = "/api/ip-assignments";

export interface IpAssignmentFilters {
  q?: string;
  subnet_id?: string;
  status?: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listIpAssignments(filters: IpAssignmentFilters): Promise<IpAssignment[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.subnet_id) params.set("subnet_id", filters.subnet_id);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return fetch(`${BASE}${qs ? `?${qs}` : ""}`).then((r) => handle(r));
}

export function createIpAssignment(data: IpAssignmentFormData): Promise<IpAssignment> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function updateIpAssignment(id: string, data: IpAssignmentFormData): Promise<IpAssignment> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteIpAssignment(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}
