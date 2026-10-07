import type { SearchResults } from "../types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  return res.json();
}

export function globalSearch(q: string): Promise<SearchResults> {
  return fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => handle(r));
}
