import { useState, type FormEvent } from "react";
import type { InventoryFormData, InventoryItem, InventoryStatus } from "../../types";
import AttachmentList from "../../components/AttachmentList";

const STATUS_OPTIONS: { value: InventoryStatus; label: string }[] = [
  { value: "aktif", label: "Aktif" },
  { value: "arizali", label: "Arızalı" },
  { value: "yedek", label: "Yedek" },
  { value: "hurda", label: "Hurda" }
];

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function toFormData(item?: InventoryItem): InventoryFormData {
  return {
    name: item?.name ?? "",
    type: item?.type ?? "",
    brand_model: item?.brand_model ?? "",
    serial_no: item?.serial_no ?? "",
    ip_address: item?.ip_address ?? "",
    location: item?.location ?? "",
    status: item?.status ?? "aktif",
    purchase_date: item?.purchase_date ?? "",
    warranty_until: item?.warranty_until ?? "",
    notes: item?.notes ?? ""
  };
}

export default function InventoryForm({
  item,
  onSubmit,
  onCancel
}: {
  item?: InventoryItem;
  onSubmit: (data: InventoryFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<InventoryFormData>(toFormData(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof InventoryFormData>(key: K, value: InventoryFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>
      )}

      <div>
        <label className={labelClass}>Cihaz Adı *</label>
        <input
          className={inputClass}
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Tür *</label>
          <input
            className={inputClass}
            required
            placeholder="server, router, ap..."
            value={form.type}
            onChange={(e) => update("type", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Durum *</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) => update("status", e.target.value as InventoryStatus)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Marka / Model</label>
          <input
            className={inputClass}
            value={form.brand_model ?? ""}
            onChange={(e) => update("brand_model", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Seri No</label>
          <input
            className={inputClass}
            value={form.serial_no ?? ""}
            onChange={(e) => update("serial_no", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>IP Adresi</label>
          <input
            className={inputClass}
            value={form.ip_address ?? ""}
            onChange={(e) => update("ip_address", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Konum</label>
          <input
            className={inputClass}
            value={form.location ?? ""}
            onChange={(e) => update("location", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Satın Alma Tarihi</label>
          <input
            type="date"
            className={inputClass}
            value={form.purchase_date ?? ""}
            onChange={(e) => update("purchase_date", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Garanti Bitişi</label>
          <input
            type="date"
            className={inputClass}
            value={form.warranty_until ?? ""}
            onChange={(e) => update("warranty_until", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Not</label>
        <textarea
          className={inputClass}
          rows={3}
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Dosya Ekleri</label>
        <AttachmentList ownerType="inventory" ownerId={item?.id} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
        >
          Vazgeç
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </form>
  );
}
