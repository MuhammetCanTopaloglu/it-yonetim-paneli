export const EXPORT_URL = "/api/backup/export";

export interface ImportResult {
  ok: true;
  totalRows: number;
  autoBackupFile: string;
}

export class SuspiciousBackupError extends Error {
  currentTotal: number;
  incomingTotal: number;

  constructor(message: string, currentTotal: number, incomingTotal: number) {
    super(message);
    this.name = "SuspiciousBackupError";
    this.currentTotal = currentTotal;
    this.incomingTotal = incomingTotal;
  }
}

export async function importBackup(fileContent: string, confirm = false): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    throw new Error("Dosya geçerli bir JSON değil");
  }

  const payload =
    typeof parsed === "object" && parsed !== null ? { ...(parsed as object), confirm } : parsed;

  const res = await fetch("/api/backup/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 409 && body.suspicious) {
      throw new SuspiciousBackupError(body.error, body.currentTotal, body.incomingTotal);
    }
    throw new Error(body.error ?? "Geri yükleme başarısız oldu");
  }

  return res.json();
}

export function backupFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `it-panel-yedek-${date}.json`;
}
