import { useEffect, useMemo, useState } from "react";
import { createNote, deleteNote, listNotes, updateNote } from "../../api/notes";
import type { Note, NoteFormData } from "../../types";
import Modal from "../../components/Modal";
import MarkdownContent from "../../components/MarkdownContent";
import TagChips, { parseTags } from "../../components/TagChips";
import NoteForm from "./NoteForm";

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);

  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined);
  const [deletingNote, setDeletingNote] = useState<Note | undefined>(undefined);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listNotes({ q, tag: activeTag });
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllForTags() {
    try {
      setAllNotes(await listNotes({}));
    } catch {
      // etiket bulutu ikincil bir özellik; sessizce yut
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, activeTag]);

  useEffect(() => {
    loadAllForTags();
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const note of allNotes) {
      for (const tag of parseTags(note.tags)) set.add(tag);
    }
    return Array.from(set).sort();
  }, [allNotes]);

  function openCreate() {
    setEditingNote(undefined);
    setModalOpen(true);
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setModalOpen(true);
  }

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? undefined : tag));
  }

  async function handleSubmit(data: NoteFormData) {
    if (editingNote) {
      await updateNote(editingNote.id, data);
    } else {
      await createNote(data);
    }
    setModalOpen(false);
    await load();
    await loadAllForTags();
  }

  async function handleDelete() {
    if (!deletingNote) return;
    await deleteNote(deletingNote.id);
    setDeletingNote(undefined);
    await load();
    await loadAllForTags();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Notlar / Runbook</h2>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
        >
          + Yeni Not
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          placeholder="Ara: başlık, içerik, etiket..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[220px] rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <TagChips tags={allTags.join(",")} activeTag={activeTag} onTagClick={handleTagClick} />
          {activeTag && (
            <button
              onClick={() => setActiveTag(undefined)}
              className="text-xs text-tertiary hover:text-primary underline"
            >
              filtreyi temizle
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      {loading && <p className="text-sm text-tertiary">Yükleniyor...</p>}
      {!loading && notes.length === 0 && <p className="text-sm text-tertiary">Kayıt bulunamadı</p>}

      <div className="space-y-4">
        {notes.map((note) => (
          <div key={note.id} className="rounded-lg border bg-surface p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="font-semibold">{note.title}</h3>
                <p className="text-xs text-tertiary mt-0.5">
                  Güncellendi: {new Date(note.updated_at).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <div className="flex gap-2 text-xs shrink-0">
                <button onClick={() => openEdit(note)} className="text-accent hover:underline">
                  Düzenle
                </button>
                <button onClick={() => setDeletingNote(note)} className="text-danger hover:underline">
                  Sil
                </button>
              </div>
            </div>
            {note.tags && (
              <div className="mb-2">
                <TagChips tags={note.tags} activeTag={activeTag} onTagClick={handleTagClick} />
              </div>
            )}
            <MarkdownContent content={note.content} />
          </div>
        ))}
      </div>

      {modalOpen && (
        <Modal title={editingNote ? "Notu Düzenle" : "Yeni Not"} onClose={() => setModalOpen(false)}>
          <NoteForm item={editingNote} onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} />
        </Modal>
      )}

      {deletingNote && (
        <Modal title="Silme Onayı" onClose={() => setDeletingNote(undefined)}>
          <p className="text-sm mb-4">
            <strong>{deletingNote.title}</strong> notunu silmek istediğinize emin misiniz?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeletingNote(undefined)}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
            >
              Vazgeç
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90"
            >
              Sil
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
