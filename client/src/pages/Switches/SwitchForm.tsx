import { useState, type FormEvent } from "react";
import type { Switch, SwitchFormData, SwitchPort } from "../../types";
import { PortRemovalConfirmError } from "../../api/switches";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function toFormData(item?: Switch): SwitchFormData {
  return {
    name: item?.name ?? "",
    model: item?.model ?? "",
    management_ip: item?.management_ip ?? "",
    port_count: item?.port_count ?? null,
    sfp_count: item?.sfp_count ?? 0,
    vlans: item?.vlans ?? "",
    location: item?.location ?? "",
    notes: item?.notes ?? "",
    is_backbone: item?.is_backbone ?? 0
  };
}

export default function SwitchForm({
  item,
  onSubmit,
  onCancel
}: {
  item?: Switch;
  onSubmit: (data: SwitchFormData, confirmPortRemoval?: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SwitchFormData>(toFormData(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occupiedPorts, setOccupiedPorts] = useState<SwitchPort[] | null>(null);

  function update<K extends keyof SwitchFormData>(key: K, value: SwitchFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOccupiedPorts(null);
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      if (err instanceof PortRemovalConfirmError) {
        setOccupiedPorts(err.occupiedPorts);
      } else {
        setError(err instanceof Error ? err.message : "Bir hata oluştu");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRemoval() {
    setError(null);
    setSaving(true);
    try {
      await onSubmit(form, true);
      setOccupiedPorts(null);
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

      {occupiedPorts && occupiedPorts.length > 0 && (
        <div className="text-sm bg-danger-soft rounded-md px-3 py-2 space-y-2">
          <p className="text-danger">
            Port {occupiedPorts.map((p) => p.port_number).join(", ")}
            {occupiedPorts.length > 1 ? "'te" : "'de"} kayıtlı bağlantılar var, silinecek — emin misiniz?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOccupiedPorts(null)}
              className="px-3 py-1 text-xs rounded-md border hover:bg-surface-secondary"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleConfirmRemoval}
              disabled={saving}
              className="px-3 py-1 text-xs rounded-md bg-danger text-white hover:brightness-90 disabled:opacity-50"
            >
              Onayla ve Sil
            </button>
          </div>
        </div>
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
          <label className={labelClass}>Model</label>
          <input
            className={inputClass}
            value={form.model ?? ""}
            onChange={(e) => update("model", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Yönetim IP</label>
          <input
            className={inputClass}
            value={form.management_ip ?? ""}
            onChange={(e) => update("management_ip", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Port Sayısı</label>
          <input
            type="number"
            className={inputClass}
            value={form.port_count ?? ""}
            onChange={(e) => update("port_count", e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass}>SFP Port Sayısı</label>
          <input
            type="number"
            className={inputClass}
            value={form.sfp_count ?? ""}
            onChange={(e) => update("sfp_count", e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Konum</label>
        <input
          className={inputClass}
          value={form.location ?? ""}
          onChange={(e) => update("location", e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>VLAN Listesi</label>
        <input
          className={inputClass}
          placeholder="10, 20, 30..."
          value={form.vlans ?? ""}
          onChange={(e) => update("vlans", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_backbone"
          checked={form.is_backbone === 1}
          onChange={(e) => update("is_backbone", e.target.checked ? 1 : 0)}
        />
        <label htmlFor="is_backbone" className="text-sm text-secondary">
          Omurga switch (etki analizinde kök olarak kullanılır)
        </label>
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
