import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import { deleteAttachmentsForOwner } from "../lib/uploads.js";
import { unlinkVaultCredentialsTarget } from "../lib/vaultLink.js";
import { unlinkLicenseAssignmentsTarget } from "../lib/licenseLink.js";
import type { InventoryItem, InventoryStatus } from "../types.js";

const router = Router();

const VALID_STATUSES: InventoryStatus[] = ["aktif", "arizali", "yedek", "hurda"];

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.get("/export/csv", (_req, res) => {
  const rows = db
    .prepare(`SELECT * FROM inventory ORDER BY name COLLATE NOCASE ASC`)
    .all() as unknown as InventoryItem[];

  const headers = [
    "name",
    "type",
    "brand_model",
    "serial_no",
    "ip_address",
    "location",
    "status",
    "purchase_date",
    "warranty_until",
    "notes"
  ];

  const lines = [headers.join(";")];
  for (const row of rows) {
    lines.push(
      headers.map((h) => csvEscape(row[h as keyof InventoryItem])).join(";")
    );
  }

  const csv = "﻿" + lines.join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="envanter.csv"`);
  res.send(csv);
});

router.get("/", (req, res) => {
  const { q, type, status } = req.query as { q?: string; type?: string; status?: string };

  const conditions: string[] = [];
  const params: (string | number | null)[] = [];

  if (q) {
    conditions.push(
      `(name LIKE ? OR brand_model LIKE ? OR serial_no LIKE ? OR ip_address LIKE ? OR location LIKE ?)`
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (type) {
    conditions.push(`type = ?`);
    params.push(type);
  }
  if (status) {
    conditions.push(`status = ?`);
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM inventory ${where} ORDER BY name COLLATE NOCASE ASC`)
    .all(...params);

  res.json(rows);
});

router.post("/bulk-status", (req, res) => {
  const { ids, status } = (req.body ?? {}) as { ids?: string[]; status?: InventoryStatus };

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids gerekli" });
  }
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Geçersiz status değeri" });
  }

  const now = new Date().toISOString();
  let updated = 0;

  db.exec("BEGIN TRANSACTION");
  try {
    const stmt = db.prepare(`UPDATE inventory SET status = ?, updated_at = ? WHERE id = ?`);
    for (const id of ids) {
      const result = stmt.run(status, now, id);
      if (result.changes > 0) updated++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return res.status(500).json({ error: `Toplu güncelleme başarısız, hiçbir değişiklik yapılmadı: ${message}` });
  }

  logChange("inventory", "update", `${updated} cihazın durumu "${status}" olarak güncellendi (toplu işlem)`);

  res.json({ updated });
});

router.post("/bulk-delete", (req, res) => {
  const { ids } = (req.body ?? {}) as { ids?: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids gerekli" });
  }

  let deleted = 0;

  db.exec("BEGIN TRANSACTION");
  try {
    const stmt = db.prepare(`DELETE FROM inventory WHERE id = ?`);
    for (const id of ids) {
      const result = stmt.run(id);
      if (result.changes > 0) {
        deleted++;
        deleteAttachmentsForOwner("inventory", id);
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return res.status(500).json({ error: `Toplu silme başarısız, hiçbir değişiklik yapılmadı: ${message}` });
  }

  logChange("inventory", "delete", `${deleted} cihaz silindi (toplu işlem)`);

  res.json({ deleted });
});

router.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM inventory WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json(row);
});

router.post("/", (req, res) => {
  const b = req.body as Partial<InventoryItem>;

  if (!b.name || !b.type || !b.status) {
    return res.status(400).json({ error: "name, type ve status zorunludur" });
  }
  if (!VALID_STATUSES.includes(b.status)) {
    return res.status(400).json({ error: "Geçersiz status değeri" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO inventory (id, name, type, brand_model, serial_no, ip_address, location, status, purchase_date, warranty_until, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    b.name,
    b.type,
    b.brand_model ?? null,
    b.serial_no ?? null,
    b.ip_address ?? null,
    b.location ?? null,
    b.status,
    b.purchase_date ?? null,
    b.warranty_until ?? null,
    b.notes ?? null,
    now,
    now
  );

  logChange("inventory", "create", `"${b.name}" envantere eklendi`, id);

  const row = db.prepare(`SELECT * FROM inventory WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM inventory WHERE id = ?`).get(req.params.id) as
    | InventoryItem
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const b = req.body as Partial<InventoryItem>;

  if (!b.name || !b.type || !b.status) {
    return res.status(400).json({ error: "name, type ve status zorunludur" });
  }
  if (!VALID_STATUSES.includes(b.status)) {
    return res.status(400).json({ error: "Geçersiz status değeri" });
  }

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE inventory SET name = ?, type = ?, brand_model = ?, serial_no = ?, ip_address = ?, location = ?, status = ?, purchase_date = ?, warranty_until = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    b.name,
    b.type,
    b.brand_model ?? null,
    b.serial_no ?? null,
    b.ip_address ?? null,
    b.location ?? null,
    b.status,
    b.purchase_date ?? null,
    b.warranty_until ?? null,
    b.notes ?? null,
    now,
    req.params.id
  );

  logChange("inventory", "update", `"${b.name}" güncellendi`, req.params.id);

  const row = db.prepare(`SELECT * FROM inventory WHERE id = ?`).get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM inventory WHERE id = ?`).get(req.params.id) as
    | InventoryItem
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM inventory WHERE id = ?`).run(req.params.id);
  deleteAttachmentsForOwner("inventory", req.params.id);
  unlinkVaultCredentialsTarget("inventory", req.params.id);
  unlinkLicenseAssignmentsTarget("inventory", req.params.id);
  logChange("inventory", "delete", `"${existing.name}" silindi`, req.params.id);

  res.status(204).send();
});

export default router;
