import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import type { Todo, TodoPriority, TodoStatus } from "../types.js";

const router = Router();

const VALID_PRIORITIES: TodoPriority[] = ["dusuk", "orta", "yuksek"];
const VALID_STATUSES: TodoStatus[] = ["bekliyor", "devam_ediyor", "tamam"];

const STATUS_LABELS: Record<TodoStatus, string> = {
  bekliyor: "Bekliyor",
  devam_ediyor: "Devam Ediyor",
  tamam: "Tamam"
};

router.get("/", (req, res) => {
  const { q } = req.query as { q?: string };

  let sql = `SELECT * FROM todos`;
  const params: string[] = [];

  if (q) {
    sql += ` WHERE (title LIKE ? OR description LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like);
  }

  sql += ` ORDER BY status ASC, sort_order ASC`;

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json(row);
});

router.post("/", (req, res) => {
  const b = req.body as Partial<Todo>;

  if (!b.title || !b.priority) {
    return res.status(400).json({ error: "title ve priority zorunludur" });
  }
  if (!VALID_PRIORITIES.includes(b.priority)) {
    return res.status(400).json({ error: "Geçersiz priority değeri" });
  }
  const status: TodoStatus = b.status && VALID_STATUSES.includes(b.status) ? b.status : "bekliyor";

  const maxOrderRow = db
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM todos WHERE status = ?`)
    .get(status) as { maxOrder: number };

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO todos (id, title, description, priority, due_date, status, related_inventory_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    b.title,
    b.description ?? null,
    b.priority,
    b.due_date ?? null,
    status,
    b.related_inventory_id ?? null,
    maxOrderRow.maxOrder + 1,
    now,
    now
  );

  logChange("todos", "create", `"${b.title}" görevi eklendi`, id);

  const row = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(req.params.id) as Todo | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const b = req.body as Partial<Todo>;

  if (!b.title || !b.priority) {
    return res.status(400).json({ error: "title ve priority zorunludur" });
  }
  if (!VALID_PRIORITIES.includes(b.priority)) {
    return res.status(400).json({ error: "Geçersiz priority değeri" });
  }

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE todos SET title = ?, description = ?, priority = ?, due_date = ?, related_inventory_id = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    b.title,
    b.description ?? null,
    b.priority,
    b.due_date ?? null,
    b.related_inventory_id ?? null,
    now,
    req.params.id
  );

  logChange("todos", "update", `"${b.title}" görevi güncellendi`, req.params.id);

  const row = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(req.params.id);
  res.json(row);
});

/**
 * Sürükle-bırak bitince tüm kolonların güncel id sırasını alır; her
 * kolon için sort_order'ı 0'dan yeniden yazar ve status değişenleri
 * changelog'a kaydeder. Sadece aynı kolon içi sıralamalarda log yazılmaz.
 */
router.post("/reorder", (req, res) => {
  const { columns } = req.body as { columns?: Record<string, string[]> };
  if (!columns) {
    return res.status(400).json({ error: "columns zorunludur" });
  }

  for (const [status, ids] of Object.entries(columns)) {
    if (!VALID_STATUSES.includes(status as TodoStatus)) {
      return res.status(400).json({ error: `Geçersiz status: ${status}` });
    }
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "Her kolon bir id dizisi olmalıdır" });
    }
  }

  const now = new Date().toISOString();

  for (const [status, ids] of Object.entries(columns)) {
    ids.forEach((id, index) => {
      const existing = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(id) as Todo | undefined;
      if (!existing) return;

      db.prepare(`UPDATE todos SET status = ?, sort_order = ?, updated_at = ? WHERE id = ?`).run(
        status,
        index,
        now,
        id
      );

      if (existing.status !== status) {
        logChange(
          "todos",
          "update",
          `"${existing.title}" görevi "${STATUS_LABELS[existing.status]}" durumundan "${STATUS_LABELS[status as TodoStatus]}" durumuna taşındı`,
          id
        );
      }
    });
  }

  res.status(204).send();
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM todos WHERE id = ?`).get(req.params.id) as Todo | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM todos WHERE id = ?`).run(req.params.id);
  logChange("todos", "delete", `"${existing.title}" görevi silindi`, req.params.id);

  res.status(204).send();
});

export default router;
