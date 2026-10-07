import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import type { SwitchLink } from "../types.js";

const router = Router();

router.get("/", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM switch_links`).all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const b = req.body as Partial<SwitchLink>;

  if (!b.source_id || !b.target_id) {
    return res.status(400).json({ error: "source_id ve target_id zorunludur" });
  }
  if (b.source_id === b.target_id) {
    return res.status(400).json({ error: "Bir switch kendine bağlanamaz" });
  }

  const duplicate = db
    .prepare(
      `SELECT id FROM switch_links WHERE (source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)`
    )
    .get(b.source_id, b.target_id, b.target_id, b.source_id);
  if (duplicate) {
    return res.status(409).json({ error: "Bu iki switch arasında zaten bir bağlantı var" });
  }

  const sourceExists = db.prepare(`SELECT id FROM switches WHERE id = ?`).get(b.source_id);
  const targetExists = db.prepare(`SELECT id FROM switches WHERE id = ?`).get(b.target_id);
  if (!sourceExists || !targetExists) {
    return res.status(400).json({ error: "Geçersiz switch id" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO switch_links (id, source_id, target_id, label, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, b.source_id, b.target_id, b.label ?? null, now);

  logChange("switch_links", "create", `Bağlantı oluşturuldu (${b.source_id} → ${b.target_id})`, id);

  const row = db.prepare(`SELECT * FROM switch_links WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM switch_links WHERE id = ?`).get(req.params.id) as
    | SwitchLink
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const { label } = req.body as { label?: string | null };

  db.prepare(`UPDATE switch_links SET label = ? WHERE id = ?`).run(label ?? null, req.params.id);

  const row = db.prepare(`SELECT * FROM switch_links WHERE id = ?`).get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM switch_links WHERE id = ?`).get(req.params.id) as
    | SwitchLink
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM switch_links WHERE id = ?`).run(req.params.id);
  logChange("switch_links", "delete", `Bağlantı silindi (${existing.source_id} → ${existing.target_id})`, req.params.id);

  res.status(204).send();
});

export default router;
