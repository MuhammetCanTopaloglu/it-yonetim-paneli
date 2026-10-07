import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import { encrypt, decrypt, DecryptionError } from "../lib/vaultCrypto.js";
import { requireUnlockedVaultKey } from "./vault.js";
import { deleteAttachmentsForOwner } from "../lib/uploads.js";
import type { License, LicenseAssignment, LicenseAssignmentTargetType } from "../types.js";

const router = Router();

const ASSIGNMENT_TARGET_TYPES: LicenseAssignmentTargetType[] = ["inventory", "switch", "other"];

/**
 * Lisans anahtarı kasanın AES-256-GCM anahtarıyla şifrelenir (bkz.
 * lib/vaultCrypto.ts) — ikinci bir kripto sistemi yok. Kasa kilitliyken
 * de LİSTE/CRUD çalışır (schema.sql yorumu), sadece anahtarı YAZMAK veya
 * OKUMAK kasanın açık olmasını gerektirir; bu yüzden bu helper sadece
 * anahtar alanına dokunulacağı an çağrılır, router genelinde değil.
 */
function getUnlockedKeyOr423(
  req: import("express").Request,
  res: import("express").Response
): Buffer | null {
  const key = requireUnlockedVaultKey(req);
  if (!key) {
    res.status(423).json({ error: "Lisans anahtarı için kasa kilitli — önce ana parolayla açın" });
    return null;
  }
  return key;
}

/** license_key_encrypted ASLA döner — LIST/GET/PUT yanıtlarında hep bu şekil kullanılır. */
function toPublicShape(row: License & { used_seats: number }) {
  return {
    id: row.id,
    product_name: row.product_name,
    vendor: row.vendor,
    total_seats: row.total_seats,
    used_seats: row.used_seats,
    purchase_date: row.purchase_date,
    start_date: row.start_date,
    renewal_date: row.renewal_date,
    cost: row.cost,
    currency: row.currency,
    has_key: row.license_key_encrypted !== null,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM license_assignments a WHERE a.license_id = l.id) AS used_seats
       FROM licenses l ORDER BY l.product_name COLLATE NOCASE ASC`
    )
    .all() as unknown as (License & { used_seats: number })[];
  res.json(rows.map(toPublicShape));
});

router.get("/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM license_assignments a WHERE a.license_id = l.id) AS used_seats
       FROM licenses l WHERE l.id = ?`
    )
    .get(req.params.id) as unknown as (License & { used_seats: number }) | undefined;
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json(toPublicShape(row));
});

interface LicenseBody {
  product_name?: string;
  vendor?: string | null;
  total_seats?: number;
  purchase_date?: string | null;
  start_date?: string | null;
  renewal_date?: string | null;
  cost?: number | null;
  currency?: string;
  notes?: string | null;
  license_key?: string | null;
}

function validateBase(body: LicenseBody): string | null {
  if (!body.product_name || !body.product_name.trim()) return "product_name zorunludur";
  if (body.total_seats !== undefined && (!Number.isInteger(body.total_seats) || body.total_seats < 1)) {
    return "total_seats en az 1 olan bir tam sayı olmalı";
  }
  return null;
}

router.post("/", (req, res) => {
  const body = (req.body ?? {}) as LicenseBody;
  const validationError = validateBase(body);
  if (validationError) return res.status(400).json({ error: validationError });

  // Anahtar SADECE kasa açıkken yazılabilir — kasa kilitliyken lisans
  // kaydı yine de oluşturulabilir (license_key alanı boş bırakılır,
  // sonradan kasa açılınca düzenlenebilir).
  let keyEncrypted: string | null = null;
  if (body.license_key) {
    const key = getUnlockedKeyOr423(req, res);
    if (!key) return;
    keyEncrypted = encrypt(key, body.license_key);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO licenses
       (id, product_name, vendor, total_seats, purchase_date, start_date, renewal_date, cost, currency, license_key_encrypted, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.product_name!.trim(),
    body.vendor ?? null,
    body.total_seats ?? 1,
    body.purchase_date ?? null,
    body.start_date ?? null,
    body.renewal_date ?? null,
    body.cost ?? null,
    body.currency ?? "TRY",
    keyEncrypted,
    body.notes ?? null,
    now,
    now
  );

  logChange("licenses", "create", `"${body.product_name!.trim()}" lisansı eklendi`, id);

  const row = db
    .prepare(`SELECT *, 0 AS used_seats FROM licenses WHERE id = ?`)
    .get(id) as unknown as License & { used_seats: number };
  res.status(201).json(toPublicShape(row));
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM licenses WHERE id = ?`).get(req.params.id) as License | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const body = (req.body ?? {}) as LicenseBody;
  const validationError = validateBase(body);
  if (validationError) return res.status(400).json({ error: validationError });

  // license_key alanı body'de HİÇ yoksa mevcut şifreli değer korunur.
  // Boş string/null gönderilirse anahtar temizlenir (kasa gerekmez — silmek
  // için çözmeye gerek yok). Dolu bir değer gönderilirse kasa açık olmalı.
  let keyEncrypted = existing.license_key_encrypted;
  if ("license_key" in body) {
    if (body.license_key) {
      const key = getUnlockedKeyOr423(req, res);
      if (!key) return;
      keyEncrypted = encrypt(key, body.license_key);
    } else {
      keyEncrypted = null;
    }
  }

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE licenses SET
       product_name = ?, vendor = ?, total_seats = ?, purchase_date = ?, start_date = ?,
       renewal_date = ?, cost = ?, currency = ?, license_key_encrypted = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    body.product_name!.trim(),
    body.vendor ?? null,
    body.total_seats ?? existing.total_seats,
    body.purchase_date ?? null,
    body.start_date ?? null,
    body.renewal_date ?? null,
    body.cost ?? null,
    body.currency ?? existing.currency,
    keyEncrypted,
    body.notes ?? null,
    now,
    req.params.id
  );

  logChange("licenses", "update", `"${body.product_name!.trim()}" güncellendi`, req.params.id);

  const row = db
    .prepare(
      `SELECT l.*, (SELECT COUNT(*) FROM license_assignments a WHERE a.license_id = l.id) AS used_seats
       FROM licenses l WHERE l.id = ?`
    )
    .get(req.params.id) as unknown as License & { used_seats: number };
  res.json(toPublicShape(row));
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM licenses WHERE id = ?`).get(req.params.id) as License | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  // license_assignments ON DELETE CASCADE ile otomatik silinir (schema.sql,
  // foreign_keys=ON pragma açık — bkz. db/connection.ts). Ekler (fatura
  // dahil) için DB'de FK yok — inventory.ts'teki aynı desenle elle temizlenir.
  deleteAttachmentsForOwner("license", req.params.id);
  db.prepare(`DELETE FROM licenses WHERE id = ?`).run(req.params.id);
  logChange("licenses", "delete", `"${existing.product_name}" silindi`, req.params.id);

  res.status(204).send();
});

// REVEAL — anahtarı O AN çözüp bir kereliğine döner, saklanmaz. changelog
// sadece "görüntülendi" olayını kaydeder, anahtarın kendisi ASLA loglanmaz.
router.post("/:id/reveal-key", (req, res) => {
  const key = getUnlockedKeyOr423(req, res);
  if (!key) return;

  const row = db.prepare(`SELECT * FROM licenses WHERE id = ?`).get(req.params.id) as License | undefined;
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  if (!row.license_key_encrypted) return res.status(404).json({ error: "Bu lisans için anahtar girilmemiş" });

  try {
    const license_key = decrypt(key, row.license_key_encrypted);
    logChange("licenses", "note", `"${row.product_name}" için lisans anahtarı görüntülendi`, row.id);
    res.json({ id: row.id, license_key });
  } catch (err) {
    if (err instanceof DecryptionError) {
      return res.status(500).json({ error: "Anahtar çözülemedi — veri bozulmuş olabilir" });
    }
    throw err;
  }
});

// ---------------------------------------------------------------------
// Koltuk atamaları (license_assignments)
// ---------------------------------------------------------------------

router.get("/:id/assignments", (req, res) => {
  const license = db.prepare(`SELECT id FROM licenses WHERE id = ?`).get(req.params.id);
  if (!license) return res.status(404).json({ error: "Lisans bulunamadı" });

  const rows = db
    .prepare(`SELECT * FROM license_assignments WHERE license_id = ? ORDER BY assigned_at ASC`)
    .all(req.params.id);
  res.json(rows);
});

router.post("/:id/assignments", (req, res) => {
  const license = db.prepare(`SELECT * FROM licenses WHERE id = ?`).get(req.params.id) as License | undefined;
  if (!license) return res.status(404).json({ error: "Lisans bulunamadı" });

  const { target_type, target_id, assigned_label, notes } = (req.body ?? {}) as {
    target_type?: string;
    target_id?: string | null;
    assigned_label?: string;
    notes?: string | null;
  };

  if (!target_type || !ASSIGNMENT_TARGET_TYPES.includes(target_type as LicenseAssignmentTargetType)) {
    return res.status(400).json({ error: "Geçersiz target_type" });
  }
  if (!assigned_label || !assigned_label.trim()) {
    return res.status(400).json({ error: "assigned_label zorunludur" });
  }

  const usedSeats = (
    db.prepare(`SELECT COUNT(*) AS c FROM license_assignments WHERE license_id = ?`).get(req.params.id) as {
      c: number;
    }
  ).c;
  if (usedSeats >= license.total_seats) {
    return res.status(400).json({ error: `Tüm koltuklar dolu (${usedSeats}/${license.total_seats})` });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO license_assignments (id, license_id, target_type, target_id, assigned_label, assigned_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.params.id, target_type, target_id ?? null, assigned_label.trim(), now, notes ?? null);

  logChange(
    "license_assignments",
    "create",
    `"${license.product_name}" lisansı "${assigned_label.trim()}" için atandı`,
    id
  );

  const row = db.prepare(`SELECT * FROM license_assignments WHERE id = ?`).get(id) as unknown as LicenseAssignment;
  res.status(201).json(row);
});

router.delete("/:licenseId/assignments/:assignmentId", (req, res) => {
  const existing = db
    .prepare(`SELECT * FROM license_assignments WHERE id = ? AND license_id = ?`)
    .get(req.params.assignmentId, req.params.licenseId) as LicenseAssignment | undefined;
  if (!existing) return res.status(404).json({ error: "Atama bulunamadı" });

  db.prepare(`DELETE FROM license_assignments WHERE id = ?`).run(req.params.assignmentId);
  logChange("license_assignments", "delete", `"${existing.assigned_label}" ataması kaldırıldı`, existing.id);

  res.status(204).send();
});

export default router;
