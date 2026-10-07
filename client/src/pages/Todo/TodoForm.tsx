import { useState, type FormEvent } from "react";
import type { InventoryItem, Todo, TodoFormData, TodoPriority } from "../../types";

const PRIORITY_OPTIONS: { value: TodoPriority; label: string }[] = [
  { value: "dusuk", label: "Düşük" },
  { value: "orta", label: "Orta" },
  { value: "yuksek", label: "Yüksek" }
];

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function toFormData(item?: Todo): TodoFormData {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    priority: item?.priority ?? "orta",
    due_date: item?.due_date ?? "",
    related_inventory_id: item?.related_inventory_id ?? null
  };
}

export default function TodoForm({
  item,
  inventory,
  onSubmit,
  onCancel
}: {
  item?: Todo;
  inventory: InventoryItem[];
  onSubmit: (data: TodoFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TodoFormData>(toFormData(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof TodoFormData>(key: K, value: TodoFormData[K]) {
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
        <label className={labelClass}>Başlık *</label>
        <input
          className={inputClass}
          required
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Açıklama</label>
        <textarea
          className={inputClass}
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Öncelik *</label>
          <select
            className={inputClass}
            value={form.priority}
            onChange={(e) => update("priority", e.target.value as TodoPriority)}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Son Tarih</label>
          <input
            type="date"
            className={inputClass}
            value={form.due_date ?? ""}
            onChange={(e) => update("due_date", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>İlgili Cihaz (opsiyonel)</label>
        <select
          className={inputClass}
          value={form.related_inventory_id ?? ""}
          onChange={(e) => update("related_inventory_id", e.target.value || null)}
        >
          <option value="">— Bağlı değil —</option>
          {inventory.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.type})
            </option>
          ))}
        </select>
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
