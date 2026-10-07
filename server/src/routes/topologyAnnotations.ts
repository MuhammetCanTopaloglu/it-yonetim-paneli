import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import type { TopologyAnnotation, TopologyAnnotationShapeKind, TopologyAnnotationType } from "../types.js";

const router = Router();

const VALID_TYPES: TopologyAnnotationType[] = ["region", "text", "shape"];
const VALID_SHAPE_KINDS: TopologyAnnotationShapeKind[] = ["box", "arrow"];

router.get("/", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM topology_annotations ORDER BY z_order ASC, created_at ASC`).all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const b = req.body as Partial<TopologyAnnotation>;

  if (!b.type || !VALID_TYPES.includes(b.type)) {
    return res.status(400).json({ error: "Geçersiz type değeri" });
  }
  if (typeof b.x !== "number" || typeof b.y !== "number") {
    return res.status(400).json({ error: "x ve y sayısal olmalıdır" });
  }
  if (b.shape_kind && !VALID_SHAPE_KINDS.includes(b.shape_kind)) {
    return res.status(400).json({ error: "Geçersiz shape_kind değeri" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO topology_annotations (id, type, x, y, width, height, text, color, shape_kind, z_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    b.type,
    b.x,
    b.y,
    b.width ?? null,
    b.height ?? null,
    b.text ?? null,
    b.color ?? null,
    b.shape_kind ?? null,
    b.z_order ?? 0,
    now,
    now
  );

  const row = db.prepare(`SELECT * FROM topology_annotations WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM topology_annotations WHERE id = ?`).get(req.params.id) as
    | TopologyAnnotation
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const b = req.body as Partial<TopologyAnnotation>;

  if (b.type && !VALID_TYPES.includes(b.type)) {
    return res.status(400).json({ error: "Geçersiz type değeri" });
  }
  if (b.shape_kind && !VALID_SHAPE_KINDS.includes(b.shape_kind)) {
    return res.status(400).json({ error: "Geçersiz shape_kind değeri" });
  }

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE topology_annotations SET type = ?, x = ?, y = ?, width = ?, height = ?, text = ?, color = ?, shape_kind = ?, z_order = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    b.type ?? existing.type,
    b.x ?? existing.x,
    b.y ?? existing.y,
    b.width !== undefined ? b.width : existing.width,
    b.height !== undefined ? b.height : existing.height,
    b.text !== undefined ? b.text : existing.text,
    b.color !== undefined ? b.color : existing.color,
    b.shape_kind !== undefined ? b.shape_kind : existing.shape_kind,
    b.z_order ?? existing.z_order,
    now,
    req.params.id
  );

  const row = db.prepare(`SELECT * FROM topology_annotations WHERE id = ?`).get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM topology_annotations WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM topology_annotations WHERE id = ?`).run(req.params.id);
  res.status(204).send();
});

export default router;
