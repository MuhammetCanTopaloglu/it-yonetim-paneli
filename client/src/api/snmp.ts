import type { SnmpDiscoverResult, SnmpQueryResult } from "../types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  return res.json();
}

export interface SnmpQueryParams {
  ip: string;
  community?: string;
  port?: number;
  switchId?: string;
}

export function querySnmpDevice(params: SnmpQueryParams): Promise<SnmpQueryResult> {
  return fetch("/api/snmp/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  }).then((r) => handle(r));
}

export interface SnmpDiscoverParams {
  ipRange: string;
  community: string;
  port?: number;
}

export function discoverSnmpDevices(params: SnmpDiscoverParams): Promise<SnmpDiscoverResult> {
  return fetch("/api/snmp/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  }).then((r) => handle(r));
}
