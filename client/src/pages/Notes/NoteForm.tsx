import { useState, type FormEvent } from "react";
import type { Note, NoteFormData } from "../../types";
import MarkdownContent from "../../components/MarkdownContent";
import AttachmentList from "../../components/AttachmentList";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function toFormData(item?: Note): NoteFormData {
  return {
    title: item?.title ?? "",
    tags: item?.tags ?? "",
    content: item?.content ?? ""
  };
}

export default function NoteForm({
  item,
  onSubmit,
  onCancel
}: {
  item?: Note;
  onSubmit: (data: NoteFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<NoteFormData>(toFormData(item));
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof NoteFormData>(key: K, value: NoteFormData[K]) {
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
        <label className={labelClass}>Etiketler (virgülle ayırın)</label>
        <input
          className={inputClass}
          placeholder="ag, switch, runbook..."
          value={form.tags ?? ""}
          onChange={(e) => update("tags", e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass}>İçerik (Markdown) *</label>
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setTab("edit")}
              className={`px-2 py-0.5 rounded-md ${
                tab === "edit" ? "bg-accent text-white" : "text-secondary hover:bg-surface-secondary"
              }`}
            >
              Düzenle
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`px-2 py-0.5 rounded-md ${
                tab === "preview" ? "bg-accent text-white" : "text-secondary hover:bg-surface-secondary"
              }`}
            >
              Önizleme
            </button>
          </div>
        </div>

        {tab === "edit" ? (
          <textarea
            className={`${inputClass} font-mono`}
            rows={10}
            required
            value={form.content}
            onChange={(e) => update("content", e.target.value)}
          />
        ) : (
          <div className="rounded-md border bg-surface px-3 py-2 min-h-[240px]">
            {form.content ? (
              <MarkdownContent content={form.content} />
            ) : (
              <p className="text-sm text-tertiary">Önizlenecek içerik yok.</p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Dosya Ekleri</label>
        <AttachmentList ownerType="note" ownerId={item?.id} />
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
