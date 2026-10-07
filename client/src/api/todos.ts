import type { Todo, TodoFormData, TodoStatus } from "../types";

const BASE = "/api/todos";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listTodos(q?: string): Promise<Todo[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return fetch(`${BASE}${qs}`).then((r) => handle(r));
}

export function createTodo(data: TodoFormData & { status?: TodoStatus }): Promise<Todo> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function updateTodo(id: string, data: TodoFormData): Promise<Todo> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteTodo(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function reorderTodos(columns: Record<TodoStatus, string[]>): Promise<void> {
  return fetch(`${BASE}/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columns })
  }).then((r) => handle(r));
}
