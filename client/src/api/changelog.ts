import type { ChangelogEntry } from "../types";

const BASE = "/api/changelog";

export interface ChangelogFilters {
  table_name?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ChangelogPage {
  items: ChangelogEntry[];
  hasMore: boolean;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  return res.json();
}

export function listChangelog(filters: ChangelogFilters): Promise<ChangelogPage> {
  const params = new URLSearchParams();
  if (filters.table_name) params.set("table_name", filters.table_name);
  if (filters.action) params.set("action", filters.action);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.q) params.set("q", filters.q);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return fetch(`${BASE}${qs ? `?${qs}` : ""}`).then((r) => handle(r));
}
