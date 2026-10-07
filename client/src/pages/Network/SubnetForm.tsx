import { useState, type FormEvent } from "react";
import type { Subnet, SubnetFormData } from "../../types";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function toFormData(item?: Subnet): SubnetFormData {
  return {
    name: item?.name ?? "",
    cidr: item?.cidr ?? "",
    vlan_id: item?.vlan_id ?? null,
    description: item?.description ?? ""
  };
}

export default function SubnetForm({
  item,
  onSubmit,
  onCancel
}: {
  item?: Subnet;
  onSubmit: (data: SubnetFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SubnetFormData>(toFormData(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SubnetFormData>(key: K, value: SubnetFormData[K]) {
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
        <label className={labelClass}>Ad *</label>
        <input
          className={inputClass}
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>CIDR *</label>
          <input
            className={inputClass}
            required
            placeholder="192.168.10.0/24"
            value={form.cidr}
            onChange={(e) => update("cidr", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>VLAN ID</label>
          <input
            type="number"
            className={inputClass}
            value={form.vlan_id ?? ""}
            onChange={(e) => update("vlan_id", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Açıklama</label>
        <textarea
          className={inputClass}
          rows={2}
          value={form.description ?? ""}
          onChange={(e) => update("description", e.target.value)}
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
