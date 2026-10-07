import type { TopologyAnnotation, TopologyAnnotationCreateData, TopologyAnnotationUpdateData } from "../types";

const BASE = "/api/topology-annotations";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listTopologyAnnotations(): Promise<TopologyAnnotation[]> {
  return fetch(BASE).then((r) => handle(r));
}

export function createTopologyAnnotation(data: TopologyAnnotationCreateData): Promise<TopologyAnnotation> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function updateTopologyAnnotation(
  id: string,
  data: TopologyAnnotationUpdateData
): Promise<TopologyAnnotation> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteTopologyAnnotation(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}
