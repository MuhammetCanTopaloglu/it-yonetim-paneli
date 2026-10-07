import type { InventoryFormData, InventoryItem, InventoryStatus } from "../types";

const BASE = "/api/inventory";

export interface InventoryFilters {
  q?: string;
  type?: string;
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

export function listInventory(filters: InventoryFilters): Promise<InventoryItem[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return fetch(`${BASE}${qs ? `?${qs}` : ""}`).then((r) => handle(r));
}

export function createInventoryItem(data: InventoryFormData): Promise<InventoryItem> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function updateInventoryItem(id: string, data: InventoryFormData): Promise<InventoryItem> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteInventoryItem(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function exportInventoryCsvUrl(): string {
  return `${BASE}/export/csv`;
}

export function bulkUpdateInventoryStatus(ids: string[], status: InventoryStatus): Promise<{ updated: number }> {
  return fetch(`${BASE}/bulk-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, status })
  }).then((r) => handle(r));
}

export function bulkDeleteInventoryItems(ids: string[]): Promise<{ deleted: number }> {
  return fetch(`${BASE}/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  }).then((r) => handle(r));
}
