import { useState, type FormEvent } from "react";
import type { InventoryItem, IpAssignment, IpAssignmentFormData, IpAssignmentStatus, Subnet } from "../../types";

const STATUS_OPTIONS: { value: IpAssignmentStatus; label: string }[] = [
  { value: "kullanimda", label: "Kullanımda" },
  { value: "bos", label: "Boş" },
  { value: "rezerve", label: "Rezerve" }
];

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function toFormData(item?: IpAssignment, defaultSubnetId?: string): IpAssignmentFormData {
  return {
    subnet_id: item?.subnet_id ?? defaultSubnetId ?? null,
    ip_address: item?.ip_address ?? "",
    device_name: item?.device_name ?? "",
    inventory_id: item?.inventory_id ?? null,
    status: item?.status ?? "bos",
    notes: item?.notes ?? ""
  };
}

export default function IpAssignmentForm({
  item,
  subnets,
  inventory,
  defaultSubnetId,
  onSubmit,
  onCancel
}: {
  item?: IpAssignment;
  subnets: Subnet[];
  inventory: InventoryItem[];
  defaultSubnetId?: string;
  onSubmit: (data: IpAssignmentFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IpAssignmentFormData>(toFormData(item, defaultSubnetId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof IpAssignmentFormData>(key: K, value: IpAssignmentFormData[K]) {
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>IP Adresi *</label>
          <input
            className={inputClass}
            required
            placeholder="192.168.10.10"
            value={form.ip_address}
            onChange={(e) => update("ip_address", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Subnet</label>
          <select
            className={inputClass}
            value={form.subnet_id ?? ""}
            onChange={(e) => update("subnet_id", e.target.value || null)}
          >
            <option value="">— Seçilmedi —</option>
            {subnets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.cidr})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Cihaz Adı</label>
          <input
            className={inputClass}
            value={form.device_name ?? ""}
            onChange={(e) => update("device_name", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Durum *</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) => update("status", e.target.value as IpAssignmentStatus)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Envanter Bağlantısı (opsiyonel)</label>
        <select
          className={inputClass}
          value={form.inventory_id ?? ""}
          onChange={(e) => update("inventory_id", e.target.value || null)}
        >
          <option value="">— Bağlı değil —</option>
          {inventory.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.type})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Not</label>
        <textarea
          className={inputClass}
          rows={2}
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
        />
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
