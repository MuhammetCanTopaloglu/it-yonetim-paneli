import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import type { IpAssignment, IpAssignmentStatus } from "../types.js";

const router = Router();

const VALID_STATUSES: IpAssignmentStatus[] = ["kullanimda", "bos", "rezerve"];

router.get("/", (req, res) => {
  const { q, subnet_id, status } = req.query as { q?: string; subnet_id?: string; status?: string };

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (q) {
    conditions.push(`(ip.ip_address LIKE ? OR ip.device_name LIKE ? OR ip.notes LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (subnet_id) {
    conditions.push(`ip.subnet_id = ?`);
    params.push(subnet_id);
  }
  if (status) {
    conditions.push(`ip.status = ?`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT ip.*, inv.name AS inventory_name, sn.name AS subnet_name
       FROM ip_assignments ip
       LEFT JOIN inventory inv ON inv.id = ip.inventory_id
       LEFT JOIN subnets sn ON sn.id = ip.subnet_id
       ${where}
       ORDER BY ip.ip_address ASC`
    )
    .all(...params);

  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM ip_assignments WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json(row);
});

router.post("/", (req, res) => {
  const b = req.body as Partial<IpAssignment>;

  if (!b.ip_address || !b.status) {
    return res.status(400).json({ error: "ip_address ve status zorunludur" });
  }
  if (!VALID_STATUSES.includes(b.status)) {
    return res.status(400).json({ error: "Geçersiz status değeri" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO ip_assignments (id, subnet_id, ip_address, device_name, inventory_id, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    b.subnet_id ?? null,
    b.ip_address,
    b.device_name ?? null,
    b.inventory_id ?? null,
    b.status,
    b.notes ?? null,
    now,
    now
  );

  logChange("ip_assignments", "create", `${b.ip_address} eşleştirmesi eklendi`, id);

  const row = db.prepare(`SELECT * FROM ip_assignments WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM ip_assignments WHERE id = ?`).get(req.params.id) as
    | IpAssignment
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const b = req.body as Partial<IpAssignment>;

  if (!b.ip_address || !b.status) {
    return res.status(400).json({ error: "ip_address ve status zorunludur" });
  }
  if (!VALID_STATUSES.includes(b.status)) {
    return res.status(400).json({ error: "Geçersiz status değeri" });
  }

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE ip_assignments SET subnet_id = ?, ip_address = ?, device_name = ?, inventory_id = ?, status = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    b.subnet_id ?? null,
    b.ip_address,
    b.device_name ?? null,
    b.inventory_id ?? null,
    b.status,
    b.notes ?? null,
    now,
    req.params.id
  );

  logChange("ip_assignments", "update", `${b.ip_address} eşleştirmesi güncellendi`, req.params.id);

  const row = db.prepare(`SELECT * FROM ip_assignments WHERE id = ?`).get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM ip_assignments WHERE id = ?`).get(req.params.id) as
    | IpAssignment
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM ip_assignments WHERE id = ?`).run(req.params.id);
  logChange("ip_assignments", "delete", `${existing.ip_address} eşleştirmesi silindi`, req.params.id);

  res.status(204).send();
});

export default router;
