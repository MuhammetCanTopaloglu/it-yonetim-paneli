import { useEffect, useRef, useState } from "react";
import {
  attachmentDownloadUrl,
  deleteAttachment,
  formatFileSize,
  isImageAttachment,
  listAttachments,
  uploadAttachment
} from "../api/attachments";
import type { Attachment, AttachmentOwnerType } from "../types";

const invoiceFieldClass =
  "w-full rounded-md border bg-surface px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-accent";
const CURRENCIES = ["TRY", "USD", "EUR"];

function formatInvoiceSummary(a: Attachment): string {
  const parts: string[] = [];
  if (a.invoice_amount != null) {
    parts.push(`${a.invoice_amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${a.invoice_currency ?? ""}`.trim());
  }
  if (a.invoice_vendor) parts.push(a.invoice_vendor);
  if (a.invoice_date) parts.push(a.invoice_date);
  return parts.join(" · ");
}

export default function AttachmentList({
  ownerType,
  ownerId
}: {
  ownerType: AttachmentOwnerType;
  ownerId?: string;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fatura olarak ekleme — işaretlenince küçük bir tutar/tedarikçi/tarih
  // formu çıkar, dosya seçilince bu bilgilerle birlikte yüklenir. Normal
  // (fatura olmayan) ekler bu alanlara hiç dokunmaz.
  const [isInvoice, setIsInvoice] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceCurrency, setInvoiceCurrency] = useState("TRY");
  const [invoiceVendor, setInvoiceVendor] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");

  async function load() {
    if (!ownerId) return;
    setLoading(true);
    try {
      setAttachments(await listAttachments(ownerType, ownerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !ownerId) return;

    setUploading(true);
    setError(null);
    try {
      await uploadAttachment(
        ownerType,
        ownerId,
        file,
        isInvoice
          ? { amount: invoiceAmount, currency: invoiceCurrency, vendor: invoiceVendor, date: invoiceDate }
          : undefined
      );
      await load();
      setIsInvoice(false);
      setInvoiceAmount("");
      setInvoiceVendor("");
      setInvoiceDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dosya yüklenemedi");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteAttachment(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  if (!ownerId) {
    return (
      <p className="text-xs text-tertiary italic">
        Dosya eklemek için önce kaydı kaydedin, sonra tekrar düzenleyin.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="text-xs text-danger mb-2">{error}</p>}

      {loading && <p className="text-xs text-tertiary">Yükleniyor...</p>}

      {!loading && attachments.length > 0 && (
        <ul className="space-y-2 mb-3">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              {isImageAttachment(a.mime_type) ? (
                <img
                  src={attachmentDownloadUrl(a.id)}
                  alt={a.original_name}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <span className="w-10 h-10 flex items-center justify-center rounded bg-surface-secondary text-lg">
                  📄
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">
                  {a.original_name}
                  {!!a.is_invoice && (
                    <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent-soft text-accent align-middle">
                      Fatura
                    </span>
                  )}
                </p>
                <p className="text-xs text-tertiary">
                  {formatFileSize(a.size)}
                  {!!a.is_invoice && formatInvoiceSummary(a) && ` · ${formatInvoiceSummary(a)}`}
                </p>
              </div>
              <a
                href={attachmentDownloadUrl(a.id)}
                className="text-xs text-accent hover:underline shrink-0"
              >
                İndir
              </a>
              <button
                onClick={() => handleDelete(a.id)}
                className="text-xs text-danger hover:underline shrink-0"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && attachments.length === 0 && (
        <p className="text-xs text-tertiary mb-3">Henüz dosya eklenmedi.</p>
      )}

      <label className="flex items-center gap-1.5 text-xs text-secondary mb-2">
        <input type="checkbox" checked={isInvoice} onChange={(e) => setIsInvoice(e.target.checked)} />
        Bu bir fatura (tutar/tedarikçi/tarih ekle)
      </label>

      {isInvoice && (
        <div className="grid grid-cols-2 gap-2 mb-2 max-w-sm">
          <input
            type="number"
            step="0.01"
            min={0}
            placeholder="Tutar"
            value={invoiceAmount}
            onChange={(e) => setInvoiceAmount(e.target.value)}
            className={invoiceFieldClass}
          />
          <select
            value={invoiceCurrency}
            onChange={(e) => setInvoiceCurrency(e.target.value)}
            className={invoiceFieldClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            placeholder="Tedarikçi"
            value={invoiceVendor}
            onChange={(e) => setInvoiceVendor(e.target.value)}
            className={invoiceFieldClass}
          />
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className={invoiceFieldClass}
          />
        </div>
      )}

      <label className="inline-block px-3 py-1.5 text-xs rounded-md border hover:bg-surface-secondary cursor-pointer">
        {uploading ? "Yükleniyor..." : isInvoice ? "+ Fatura Dosyası Seç" : "+ Dosya Ekle"}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelected}
          disabled={uploading}
          className="hidden"
        />
      </label>
      <p className="text-xs text-tertiary mt-1">
        İzin verilen: resim, PDF, txt, config dosyaları. Maks 10MB.
      </p>
    </div>
  );
}
