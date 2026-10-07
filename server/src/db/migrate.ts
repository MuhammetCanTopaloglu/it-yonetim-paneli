import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "./connection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function columnExists(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

/**
 * `CREATE TABLE IF NOT EXISTS` sadece hiç var olmayan tabloları oluşturur —
 * mevcut bir kurulumda tablo zaten varsa şemadaki yeni kolonlara DOKUNMAZ.
 * Bu yüzden var olan veritabanlarına sonradan eklenen kolonları burada elle
 * ekliyoruz. Kolon zaten varsa hiçbir şey yapılmaz (idempotent) — mevcut
 * satırlar/veri asla silinmez veya değiştirilmez, sadece yeni kolon
 * belirtilen varsayılan değerle eklenir.
 */
function ensureColumn(table: string, column: string, definition: string): void {
  if (!columnExists(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * attachments.owner_type CHECK'ine 'license' eklemek (ve is_invoice/
 * invoice_* kolonlarını eklemek) SQLite'ta ALTER TABLE ile yapılamaz —
 * CHECK constraint'leri sadece tablo yeniden oluşturularak değiştirilebilir.
 * Var olan bir kurulumda eski CHECK (sadece 'inventory','note') hâlâ
 * yürürlükteyse: yeni şemayla bir tablo oluşturup tüm satırları KAYIPSIZ
 * kopyalar, eskiyi silip yeniyi yeniden adlandırır — hepsi TEK transaction
 * içinde (ara adımda hata olursa ROLLBACK, mevcut ekler asla kaybolmaz).
 * Zaten yeni şemadaysa (is_invoice kolonu var) hiçbir şey yapmaz.
 */
function migrateAttachmentsLicenseSupport(): void {
  if (columnExists("attachments", "is_invoice")) return;

  db.exec("BEGIN TRANSACTION");
  try {
    db.exec(`
      CREATE TABLE attachments_new (
        id TEXT PRIMARY KEY,
        owner_type TEXT NOT NULL CHECK (owner_type IN ('inventory', 'note', 'license')),
        owner_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT,
        is_invoice INTEGER NOT NULL DEFAULT 0,
        invoice_amount REAL,
        invoice_currency TEXT,
        invoice_vendor TEXT,
        invoice_date TEXT,
        created_at TEXT NOT NULL
      )
    `);
    db.exec(`
      INSERT INTO attachments_new (id, owner_type, owner_id, original_name, stored_name, size, mime_type, created_at)
      SELECT id, owner_type, owner_id, original_name, stored_name, size, mime_type, created_at FROM attachments
    `);
    db.exec("DROP TABLE attachments");
    db.exec("ALTER TABLE attachments_new RENAME TO attachments");
    db.exec("CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments(owner_type, owner_id)");
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function runMigrations(): void {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  // Eklentili (additive) migration'lar — sırayla, her biri idempotent.
  ensureColumn("switches", "sfp_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("switch_ports", "port_type", "TEXT NOT NULL DEFAULT 'copper'");
  ensureColumn("switches", "snmp_community", "TEXT");
  ensureColumn("switches", "is_backbone", "INTEGER NOT NULL DEFAULT 0");
  migrateAttachmentsLicenseSupport();

  // İlk admin artık burada otomatik oluşturulmuyor — konsolu olmayan paketli
  // Electron modunda bu görünmezdi. Bunun yerine `users` tablosu boşken
  // frontend "İlk Admin Hesabı Oluştur" ekranını gösterir, kullanıcı adı/şifre
  // POST /api/auth/setup-first-admin ile belirlenir (bkz. routes/auth.ts).
}
