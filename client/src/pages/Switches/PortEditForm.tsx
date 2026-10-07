import { useState, type FormEvent } from "react";
import type {
  InventoryItem,
  Switch,
  SwitchPort,
  SwitchPortConnectionType,
  SwitchPortFormData,
  SwitchPortStatus
} from "../../types";

const STATUS_OPTIONS: { value: SwitchPortStatus; label: string }[] = [
  { value: "bos", label: "Boş" },
  { value: "dolu", label: "Dolu" },
  { value: "kapali", label: "Kapalı" },
  { value: "uplink", label: "Uplink" }
];

const CONNECTION_TYPE_OPTIONS: { value: SwitchPortConnectionType; label: string }[] = [
  { value: "inventory", label: "Envanterden Cihaz" },
  { value: "switch", label: "Başka Switch" },
  { value: "other", label: "Serbest Metin" }
];

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function toFormData(port: SwitchPort): SwitchPortFormData {
  return {
    label: port.label ?? "",
    status: port.status,
    connection_type: port.connection_type,
    connected_inventory_id: port.connected_inventory_id,
    connected_switch_id: port.connected_switch_id,
    connected_port_number: port.connected_port_number,
    connected_label: port.connected_label ?? "",
    vlan: port.vlan ?? "",
    notes: port.notes ?? ""
  };
}

export default function PortEditForm({
  port,
  switches,
  inventory,
  onSubmit,
  onCancel
}: {
  port: SwitchPort;
  switches: Switch[];
  inventory: InventoryItem[];
  onSubmit: (data: SwitchPortFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SwitchPortFormData>(toFormData(port));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SwitchPortFormData>(key: K, value: SwitchPortFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isOccupied = form.status === "dolu" || form.status === "uplink";

  function handleStatusChange(status: SwitchPortStatus) {
    setForm((prev) => ({ ...prev, status }));
  }

  function handleConnectionTypeChange(connection_type: SwitchPortConnectionType) {
    setForm((prev) => ({
      ...prev,
      connection_type,
      connected_inventory_id: null,
      connected_switch_id: null,
      connected_port_number: null,
      connected_label: ""
    }));
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
          <label className={labelClass}>Port No</label>
          <input className={inputClass} value={port.port_number} disabled />
        </div>
        <div>
          <label className={labelClass}>Durum *</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) => handleStatusChange(e.target.value as SwitchPortStatus)}
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
        <label className={labelClass}>Etiket</label>
        <input
          className={inputClass}
          placeholder="ör. Uplink-1"
          value={form.label ?? ""}
          onChange={(e) => update("label", e.target.value)}
        />
      </div>

      {isOccupied && (
        <div className="rounded-md border border-dashed p-3 space-y-3">
          <div>
            <label className={labelClass}>Bağlantı Türü</label>
            <select
              className={inputClass}
              value={form.connection_type ?? ""}
              onChange={(e) => handleConnectionTypeChange(e.target.value as SwitchPortConnectionType)}
            >
              <option value="" disabled>
                — Seçin —
              </option>
              {CONNECTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {form.connection_type === "inventory" && (
            <div>
              <label className={labelClass}>Cihaz</label>
              <select
                className={inputClass}
                value={form.connected_inventory_id ?? ""}
                onChange={(e) => update("connected_inventory_id", e.target.value || null)}
              >
                <option value="">— Seçin —</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.connection_type === "switch" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Hedef Switch</label>
                <select
                  className={inputClass}
                  value={form.connected_switch_id ?? ""}
                  onChange={(e) => update("connected_switch_id", e.target.value || null)}
                >
                  <option value="">— Seçin —</option>
                  {switches.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Karşı Port No (opsiyonel)</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.connected_port_number ?? ""}
                  onChange={(e) =>
                    update("connected_port_number", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </div>
            </div>
          )}

          {form.connection_type === "other" && (
            <div>
              <label className={labelClass}>Açıklama</label>
              <input
                className={inputClass}
                placeholder="ör. Duvar Prizi - Ofis 3"
                value={form.connected_label ?? ""}
                onChange={(e) => update("connected_label", e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>VLAN</label>
          <input
            className={inputClass}
            value={form.vlan ?? ""}
            onChange={(e) => update("vlan", e.target.value)}
          />
        </div>
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
