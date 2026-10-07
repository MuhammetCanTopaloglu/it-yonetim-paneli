import { Router, type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import { sanitizeFilename, upload, uploadsDir } from "../lib/uploads.js";
import type { Attachment, AttachmentOwnerType } from "../types.js";

const router = Router();

const VALID_OWNER_TYPES: AttachmentOwnerType[] = ["inventory", "note", "license"];

function ownerTable(ownerType: AttachmentOwnerType): string {
  if (ownerType === "inventory") return "inventory";
  if (ownerType === "license") return "licenses";
  return "notes";
}

// multer hatalarını (dosya boyutu, izin verilmeyen tür) JSON olarak döndürmek için sarmalayıcı
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Dosya çok büyük (maksimum 10MB)" });
      }
      const message = err instanceof Error ? err.message : "Dosya yüklenemedi";
      return res.status(400).json({ error: message });
    }
    next();
  });
}

router.get("/", (req, res) => {
  const { owner_type, owner_id } = req.query as { owner_type?: string; owner_id?: string };
  if (!owner_type || !owner_id || !VALID_OWNER_TYPES.includes(owner_type as AttachmentOwnerType)) {
    return res.status(400).json({ error: "Geçersiz owner_type/owner_id" });
  }

  const rows = db
    .prepare(`SELECT * FROM attachments WHERE owner_type = ? AND owner_id = ? ORDER BY created_at ASC`)
    .all(owner_type, owner_id);

  res.json(rows);
});

router.post("/", uploadSingle, (req, res) => {
  // multipart/form-data: tüm alanlar string gelir — is_invoice "true"/"false".
  const {
    owner_type,
    owner_id,
    is_invoice,
    invoice_amount,
    invoice_currency,
    invoice_vendor,
    invoice_date
  } = req.body as {
    owner_type?: string;
    owner_id?: string;
    is_invoice?: string;
    invoice_amount?: string;
    invoice_currency?: string;
    invoice_vendor?: string;
    invoice_date?: string;
  };
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "Dosya bulunamadı" });
  }

  if (!owner_type || !VALID_OWNER_TYPES.includes(owner_type as AttachmentOwnerType) || !owner_id) {
    fs.rm(file.path, { force: true }, () => {});
    return res.status(400).json({ error: "Geçersiz owner_type/owner_id" });
  }

  const type = owner_type as AttachmentOwnerType;
  const owner = db.prepare(`SELECT id FROM ${ownerTable(type)} WHERE id = ?`).get(owner_id);
  if (!owner) {
    fs.rm(file.path, { force: true }, () => {});
    return res.status(404).json({ error: "İlgili kayıt bulunamadı" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const originalName = sanitizeFilename(file.originalname);
  const isInvoiceFlag = is_invoice === "true" || is_invoice === "1" ? 1 : 0;

  db.prepare(
    `INSERT INTO attachments
       (id, owner_type, owner_id, original_name, stored_name, size, mime_type, is_invoice, invoice_amount, invoice_currency, invoice_vendor, invoice_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    type,
    owner_id,
    originalName,
    file.filename,
    file.size,
    file.mimetype ?? null,
    isInvoiceFlag,
    isInvoiceFlag && invoice_amount ? Number(invoice_amount) : null,
    isInvoiceFlag ? invoice_currency || null : null,
    isInvoiceFlag ? invoice_vendor || null : null,
    isInvoiceFlag ? invoice_date || null : null,
    now
  );

  logChange(
    ownerTable(type),
    "create",
    isInvoiceFlag ? `"${originalName}" faturası eklendi` : `"${originalName}" dosyası eklendi`,
    owner_id
  );

  const row = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.get("/:id/download", (req, res) => {
  const row = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(req.params.id) as
    | Attachment
    | undefined;
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const filePath = path.join(uploadsDir, row.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Dosya diskte bulunamadı" });
  }

  res.download(filePath, row.original_name);
});

router.delete("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(req.params.id) as
    | Attachment
    | undefined;
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const filePath = path.join(uploadsDir, row.stored_name);
  fs.rm(filePath, { force: true }, () => {});

  db.prepare(`DELETE FROM attachments WHERE id = ?`).run(req.params.id);
  logChange(
    ownerTable(row.owner_type),
    "delete",
    `"${row.original_name}" dosyası silindi`,
    row.owner_id
  );

  res.status(204).send();
});

export default router;
