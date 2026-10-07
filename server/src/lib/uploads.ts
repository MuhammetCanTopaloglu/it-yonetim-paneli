import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { db, dataDir } from "../db/connection.js";

export const uploadsDir = path.join(dataDir, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// İzin verilen uzantılar: resim, PDF, düz metin, yapılandırma dosyaları.
// Çalıştırılabilir dosyalar (.exe, .bat, .sh, .ps1 vb.) bilinçli olarak dışarıda —
// allowlist yaklaşımı, listede olmayan HER ŞEY reddedilir.
const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".conf",
  ".cfg",
  ".ini",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".log"
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Path traversal ve header injection'a karşı: sadece dosya adının kendisini
 * (dizin bileşenleri atılmış) ve kontrol karakterlerinden arındırılmış halini döner.
 */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[\\/]/g, "");
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, "").trim();
  return cleaned.slice(0, 255) || "dosya";
}

function extensionOf(filename: string): string {
  return path.extname(sanitizeFilename(filename)).toLowerCase();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error(`Desteklenmeyen dosya türü: ${ext || "(uzantısız)"}`));
      return;
    }
    cb(null, true);
  }
});

export interface AttachmentRow {
  id: string;
  owner_type: "inventory" | "note" | "license";
  owner_id: string;
  original_name: string;
  stored_name: string;
  size: number;
  mime_type: string | null;
  created_at: string;
}

/**
 * Bir envanter/not/lisans kaydı silinirken bağlı tüm dosya eklerini (hem disk
 * hem DB) temizler. inventory.ts, notes.ts ve licenses.ts DELETE
 * handler'larından çağrılır.
 */
export function deleteAttachmentsForOwner(ownerType: "inventory" | "note" | "license", ownerId: string): number {
  const rows = db
    .prepare(`SELECT * FROM attachments WHERE owner_type = ? AND owner_id = ?`)
    .all(ownerType, ownerId) as unknown as AttachmentRow[];

  for (const row of rows) {
    const filePath = path.join(uploadsDir, row.stored_name);
    fs.rm(filePath, { force: true }, () => {});
  }

  db.prepare(`DELETE FROM attachments WHERE owner_type = ? AND owner_id = ?`).run(ownerType, ownerId);

  return rows.length;
}
