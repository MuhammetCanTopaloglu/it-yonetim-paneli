import type { Note, NoteFormData } from "../types";

const BASE = "/api/notes";

export interface NoteFilters {
  q?: string;
  tag?: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listNotes(filters: NoteFilters): Promise<Note[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tag) params.set("tag", filters.tag);
  const qs = params.toString();
  return fetch(`${BASE}${qs ? `?${qs}` : ""}`).then((r) => handle(r));
}

export function createNote(data: NoteFormData): Promise<Note> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function updateNote(id: string, data: NoteFormData): Promise<Note> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteNote(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}
