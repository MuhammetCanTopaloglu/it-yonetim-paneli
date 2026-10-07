import { VaultLockedError } from "./vault";
import type {
  License,
  LicenseAssignment,
  LicenseAssignmentInput,
  LicenseFormData,
  RevealedLicenseKey
} from "../types";

const BASE = "/api/licenses";

/** Kasa deseniyle aynı: anahtar yazma/okuma kasa kilitliyken 423 döner. */
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

export function listLicenses(): Promise<License[]> {
  return fetch(BASE).then((r) => handle(r));
}

export function createLicense(data: LicenseFormData): Promise<License> {
  return fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function updateLicense(id: string, data: LicenseFormData): Promise<License> {
  return fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteLicense(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function revealLicenseKey(id: string): Promise<RevealedLicenseKey> {
  return fetch(`${BASE}/${id}/reveal-key`, { method: "POST" }).then((r) => handle(r));
}

export function listLicenseAssignments(licenseId: string): Promise<LicenseAssignment[]> {
  return fetch(`${BASE}/${licenseId}/assignments`).then((r) => handle(r));
}

export function createLicenseAssignment(
  licenseId: string,
  data: LicenseAssignmentInput
): Promise<LicenseAssignment> {
  return fetch(`${BASE}/${licenseId}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then((r) => handle(r));
}

export function deleteLicenseAssignment(licenseId: string, assignmentId: string): Promise<void> {
  return fetch(`${BASE}/${licenseId}/assignments/${assignmentId}`, { method: "DELETE" }).then((r) => handle(r));
}
