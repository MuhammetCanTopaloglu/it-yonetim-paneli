import { useState } from "react";
import type { TopologyAnnotation } from "../../types";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

const COLOR_PRESETS = ["#1670a6", "#c8850f", "#d64545", "#1a9e76", "#94a0b2"];

export default function AnnotationEditModal({
  annotation,
  onSave,
  onDelete,
  onCancel
}: {
  annotation: TopologyAnnotation;
  onSave: (data: { text: string | null; color: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(annotation.text ?? "");
  const [color, setColor] = useState(annotation.color ?? COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegion = annotation.type === "region";
  const isShape = annotation.type === "shape";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({ text: isShape ? null : text.trim(), color });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setSaving(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}

      {!isShape && (
        <div>
          <label className={labelClass}>{isRegion ? "Etiket" : "Not Metni"}</label>
          {isRegion ? (
            <input
              className={inputClass}
              placeholder="ör. Server Odası"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          ) : (
            <textarea
              className={inputClass}
              rows={3}
              placeholder="ör. buradan fiber çekilecek"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          )}
        </div>
      )}

      <div>
        <label className={labelClass}>Renk</label>
        <div className="flex gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              aria-pressed={color === c}
              className={`w-7 h-7 rounded-full transition-transform duration-150 ${
                color === c ? "ring-2 ring-offset-2 ring-accent scale-110" : "hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-secondary">Emin misiniz?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90 disabled:opacity-50"
            >
              Sil
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
            >
              Vazgeç
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-sm text-danger hover:underline"
          >
            Sil
          </button>
        )}

        <div className="flex gap-2">
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
      </div>
    </form>
  );
}
