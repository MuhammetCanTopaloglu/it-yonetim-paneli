import type { Attachment, AttachmentOwnerType, InvoiceInput } from "../types";

const BASE = "/api/attachments";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "İstek başarısız oldu");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listAttachments(ownerType: AttachmentOwnerType, ownerId: string): Promise<Attachment[]> {
  const params = new URLSearchParams({ owner_type: ownerType, owner_id: ownerId });
  return fetch(`${BASE}?${params}`).then((r) => handle(r));
}

export function uploadAttachment(
  ownerType: AttachmentOwnerType,
  ownerId: string,
  file: File,
  invoice?: InvoiceInput
): Promise<Attachment> {
  const formData = new FormData();
  formData.append("owner_type", ownerType);
  formData.append("owner_id", ownerId);
  formData.append("file", file);
  if (invoice) {
    formData.append("is_invoice", "true");
    if (invoice.amount) formData.append("invoice_amount", invoice.amount);
    if (invoice.currency) formData.append("invoice_currency", invoice.currency);
    if (invoice.vendor) formData.append("invoice_vendor", invoice.vendor);
    if (invoice.date) formData.append("invoice_date", invoice.date);
  }
  return fetch(BASE, { method: "POST", body: formData }).then((r) => handle(r));
}

export function deleteAttachment(id: string): Promise<void> {
  return fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle(r));
}

export function attachmentDownloadUrl(id: string): string {
  return `${BASE}/${id}/download`;
}

export function isImageAttachment(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
