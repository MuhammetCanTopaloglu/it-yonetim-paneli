import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import { deleteAttachmentsForOwner } from "../lib/uploads.js";
import type { Note } from "../types.js";

const router = Router();

router.get("/", (req, res) => {
  const { q, tag } = req.query as { q?: string; tag?: string };

  const conditions: string[] = [];
  const params: string[] = [];

  if (q) {
    conditions.push(`(title LIKE ? OR content LIKE ? OR tags LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (tag) {
    conditions.push(`tags LIKE ?`);
    params.push(`%${tag}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM notes ${where} ORDER BY updated_at DESC`)
    .all(...params);

  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json(row);
});

router.post("/", (req, res) => {
  const b = req.body as Partial<Note>;

  if (!b.title || !b.content) {
    return res.status(400).json({ error: "title ve content zorunludur" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO notes (id, title, tags, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, b.title, b.tags ?? null, b.content, now, now);

  logChange("notes", "create", `"${b.title}" notu eklendi`, id);

  const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(req.params.id) as
    | Note
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const b = req.body as Partial<Note>;

  if (!b.title || !b.content) {
    return res.status(400).json({ error: "title ve content zorunludur" });
  }

  const now = new Date().toISOString();

  db.prepare(`UPDATE notes SET title = ?, tags = ?, content = ?, updated_at = ? WHERE id = ?`).run(
    b.title,
    b.tags ?? null,
    b.content,
    now,
    req.params.id
  );

  logChange("notes", "update", `"${b.title}" notu güncellendi`, req.params.id);

  const row = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM notes WHERE id = ?`).get(req.params.id) as
    | Note
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM notes WHERE id = ?`).run(req.params.id);
  deleteAttachmentsForOwner("note", req.params.id);
  logChange("notes", "delete", `"${existing.title}" notu silindi`, req.params.id);

  res.status(204).send();
});

export default router;
