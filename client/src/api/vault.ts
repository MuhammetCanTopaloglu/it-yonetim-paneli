import type {
  RevealedVaultCredential,
  VaultCredentialInput,
  VaultCredentialSummary,
  VaultStatus
} from "../types";

const BASE = "/api/vault";

/** Kasa kilitliyken CRUD/reveal 423 döner — arayüz bunu ayırt edip kilit ekranına düşebilsin diye ayrı bir hata tipi. */
export class VaultLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultLockedError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 423) {
      throw new VaultLockedError(body.error ?? "Kasa kilitli");
    }
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getVaultStatus(): Promise<VaultStatus> {
  return fetch(`${BASE}/status`).then((r) => handle(r));
}

export function setupVault(masterPassword: string, acknowledged: boolean): Promise<void> {
  return fetch(`${BASE}/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ masterPassword, acknowledged })
  }).then((r) => handle(r));
}

export function unlockVault(masterPassword: string): Promise<void> {
  return fetch(`${BASE}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ masterPassword })
  }).then((r) => handle(r));
}

export function lockVault(): Promise<void> {
  return fetch(`${BASE}/lock`, { method: "POST" }).then((r) => handle(r));
}

export function changeMasterPassword(oldPassword: string, newPassword: string): Promise<{ reencryptedCount: number }> {
  return fetch(`${BASE}/change-master-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPassword, newPassword })
  }).then((r) => handle(r));
}

export function listVaultCredentials(): Promise<VaultCredentialSummary[]> {
  return fetch(`${BASE}/credentials`).then((r) => handle(r));
}

export function createVaultCredential(data: VaultCredentialInput): Promise<VaultCredentialSummary> {
  return fetch(`${BASE}/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function updateVaultCredential(id: string, data: VaultCredentialInput): Promise<VaultCredentialSummary> {
  return fetch(`${BASE}/credentials/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteVaultCredential(id: string): Promise<void> {
  return fetch(`${BASE}/credentials/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function revealVaultCredential(id: string): Promise<RevealedVaultCredential> {
  return fetch(`${BASE}/credentials/${id}/reveal`, { method: "POST" }).then((r) => handle(r));
}
