import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { db, dataDir } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";

const router = Router();

const SCHEMA_VERSION = 1;

const MAX_AUTO_BACKUPS = 5;
// "Çok daha az" eşiği: içe aktarılan yedek, mevcut veriden bu oranda (veya
// daha fazla) küçükse şüpheli kabul edilir ve ekstra onay istenir.
const SUSPICIOUS_DROP_RATIO = 0.5;

/**
 * Her tablo için beklenen kolon listesi. İçe aktarma sırasında satır
 * nesnelerinden SADECE bu kolonlar okunur — kullanıcının yüklediği JSON'daki
 * anahtar adları asla SQL tanımlayıcısı olarak kullanılmaz (injection riski yok).
 */
const TABLE_COLUMNS: Record<string, string[]> = {
  inventory: [
    "id",
    "name",
    "type",
    "brand_model",
    "serial_no",
    "ip_address",
    "location",
    "status",
    "purchase_date",
    "warranty_until",
    "notes",
    "created_at",
    "updated_at"
  ],
  subnets: ["id", "name", "cidr", "vlan_id", "description", "created_at"],
  switches: [
    "id",
    "name",
    "model",
    "management_ip",
    "port_count",
    "sfp_count",
    "vlans",
    "location",
    "notes",
    "pos_x",
    "pos_y",
    "created_at",
    "updated_at"
  ],
  switch_links: ["id", "source_id", "target_id", "label", "created_at"],
  switch_ports: [
    "id",
    "switch_id",
    "port_number",
    "port_type",
    "label",
    "status",
    "connection_type",
    "connected_inventory_id",
    "connected_switch_id",
    "connected_port_number",
    "connected_label",
    "vlan",
    "notes",
    "created_at",
    "updated_at"
  ],
  ip_assignments: [
    "id",
    "subnet_id",
    "ip_address",
    "device_name",
    "inventory_id",
    "status",
    "notes",
    "created_at",
    "updated_at"
  ],
  todos: [
    "id",
    "title",
    "description",
    "priority",
    "due_date",
    "status",
    "related_inventory_id",
    "sort_order",
    "created_at",
    "updated_at"
  ],
  notes: ["id", "title", "tags", "content", "created_at", "updated_at"],
  changelog: ["id", "table_name", "record_id", "action", "description", "created_at"],
  // NOT: sadece metadata — asıl dosya içeriği data/uploads/ klasöründedir ve
  // bu yedeğe DAHİL DEĞİLDİR (bkz. README "Yedekleme" bölümü).
  attachments: [
    "id",
    "owner_type",
    "owner_id",
    "original_name",
    "stored_name",
    "size",
    "mime_type",
    "is_invoice",
    "invoice_amount",
    "invoice_currency",
    "invoice_vendor",
    "invoice_date",
    "created_at"
  ],
  topology_annotations: [
    "id",
    "type",
    "x",
    "y",
    "width",
    "height",
    "text",
    "color",
    "shape_kind",
    "z_order",
    "created_at",
    "updated_at"
  ],
  // NOT: password_hash dahil — restore sonrası kimse giriş yapamaz hale
  // gelmesin diye. sessions tablosu (geçici oturum verisi) bilerek yedeğe
  // dahil edilmiyor, restore sonrası herkes zaten yeniden giriş yapar.
  users: [
    "id",
    "username",
    "password_hash",
    "role",
    "failed_attempts",
    "locked_until",
    "created_at",
    "updated_at"
  ],
  // KASA — DB'de zaten sadece ŞİFRELİ hâliyle duran alanlar OLDUĞU GİBİ
  // yedeğe giriyor (decrypt çağrısı YOK, kasa kilitliyken bile export
  // çalışır — bkz. buildExportPayload: sadece SELECT *). salt/kdf/verifier
  // de dahil olduğu için yedek başka bir makineye yüklenince AYNI ana
  // parolayla açılabilir (anahtar türetme deterministik).
  vault_meta: ["id", "salt", "kdf_n", "kdf_r", "kdf_p", "verifier", "failed_attempts", "locked_until", "created_at"],
  vault_credentials: [
    "id",
    "target_type",
    "target_id",
    "label",
    "username_encrypted",
    "password_encrypted",
    "notes_encrypted",
    "created_at",
    "updated_at"
  ],
  // LİSANSLAR — license_key_encrypted kasadaki gibi ŞİFRELİ hâliyle olduğu
  // gibi yedeğe girer (decrypt çağrısı YOK, kasa kilitliyken bile export
  // çalışır — aynı garanti vault_credentials için de geçerli, bkz. yukarı).
  licenses: [
    "id",
    "product_name",
    "vendor",
    "total_seats",
    "purchase_date",
    "start_date",
    "renewal_date",
    "cost",
    "currency",
    "license_key_encrypted",
    "notes",
    "created_at",
    "updated_at"
  ],
  license_assignments: ["id", "license_id", "target_type", "target_id", "assigned_label", "assigned_at", "notes"]
};

// Yabancı anahtarlar nedeniyle: silme önce çocuk tablolar, ekleme önce ebeveyn tablolar sırasıyla yapılmalı.
// vault_credentials.target_id switches/inventory'ye POLİMORFİK bağlanıyor
// (gerçek bir DB FK'sı yok, bkz. schema.sql/vaultLink.ts yorumu) — bu yüzden
// sıralaması FK açısından zorunlu değil, ama mantıksal temizlik için önce
// silinip switches/inventory'den SONRA ekleniyor.
const DELETE_ORDER = [
  "license_assignments",
  "licenses",
  "vault_credentials",
  "vault_meta",
  "users",
  "topology_annotations",
  "switch_links",
  "switch_ports",
  "ip_assignments",
  "todos",
  "changelog",
  "attachments",
  "notes",
  "switches",
  "subnets",
  "inventory"
];
const INSERT_ORDER = [
  "users",
  "inventory",
  "subnets",
  "switches",
  "ip_assignments",
  "switch_links",
  "switch_ports",
  "todos",
  "notes",
  "attachments",
  "changelog",
  "topology_annotations",
  "vault_meta",
  "vault_credentials",
  "licenses",
  "license_assignments"
];

function buildExportPayload(): { schema_version: number; exported_at: string; tables: Record<string, unknown[]> } {
  const tables: Record<string, unknown[]> = {};
  for (const table of INSERT_ORDER) {
    tables[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  return { schema_version: SCHEMA_VERSION, exported_at: new Date().toISOString(), tables };
}

function countCurrentRows(): number {
  let total = 0;
  for (const table of INSERT_ORDER) {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
    total += row.c;
  }
  return total;
}

function countIncomingRows(tables: Record<string, unknown[]>): number {
  let total = 0;
  for (const table of Object.keys(TABLE_COLUMNS)) {
    total += (tables[table] ?? []).length;
  }
  return total;
}

/**
 * Yıkıcı bir geri yüklemeden HEMEN ÖNCE mevcut veritabanının tam bir JSON
 * yedeğini data/ altına yazar. İçe aktarma yanlış giderse buradan elle geri
 * dönülebilir. Son MAX_AUTO_BACKUPS dosya tutulur, eskiler silinir.
 * Yazma başarısız olursa hata fırlatır — çağıran taraf bu durumda içe
 * aktarmayı İPTAL etmeli (güvenlik ağı yoksa yıkıcı işlem yapılmamalı).
 */
function writeAutoBackupBeforeRestore(): string {
  const payload = buildExportPayload();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `auto-backup-before-restore-${stamp}.json`;
  const filePath = path.join(dataDir, fileName);

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");

  const existing = fs
    .readdirSync(dataDir)
    .filter((f) => f.startsWith("auto-backup-before-restore-") && f.endsWith(".json"))
    .sort(); // ISO zaman damgası dosya adında olduğu için alfabetik sıra = kronolojik sıra

  const toDelete = existing.slice(0, Math.max(0, existing.length - MAX_AUTO_BACKUPS));
  for (const f of toDelete) {
    fs.rmSync(path.join(dataDir, f), { force: true });
  }

  return fileName;
}

router.get("/export", (_req, res) => {
  const payload = buildExportPayload();
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="it-panel-yedek-${dateStr}.json"`);
  res.send(JSON.stringify(payload, null, 2));
});

router.get("/auto-backups", (_req, res) => {
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.startsWith("auto-backup-before-restore-") && f.endsWith(".json"))
    .sort()
    .reverse()
    .map((f) => {
      const stat = fs.statSync(path.join(dataDir, f));
      return { fileName: f, size: stat.size, createdAt: stat.mtime.toISOString() };
    });
  res.json(files);
});

function validateBackup(body: unknown): { error: string } | { tables: Record<string, unknown[]> } {
  if (!body || typeof body !== "object") {
    return { error: "Geçersiz dosya: JSON nesnesi bekleniyor" };
  }
  const b = body as Record<string, unknown>;

  if (b.schema_version !== SCHEMA_VERSION) {
    return { error: `Desteklenmeyen schema_version: ${String(b.schema_version)} (beklenen: ${SCHEMA_VERSION})` };
  }
  if (!b.tables || typeof b.tables !== "object") {
    return { error: "Geçersiz dosya: 'tables' alanı bulunamadı" };
  }

  // Eski yedeklerde henüz var olmayan bir tablo (ör. sonradan eklenen switch_ports)
  // eksik olabilir — bu durumda boş kabul edilir, reddedilmez. Sadece MEVCUT
  // olup da yanlış tipte olan alanlar hataya düşürülür.
  const tables = b.tables as Record<string, unknown>;
  for (const tableName of Object.keys(TABLE_COLUMNS)) {
    if (tables[tableName] !== undefined && !Array.isArray(tables[tableName])) {
      return { error: `Geçersiz dosya: '${tableName}' tablosu bir dizi olmalı` };
    }
  }

  return { tables: tables as Record<string, unknown[]> };
}

router.post("/import", (req, res) => {
  const validation = validateBackup(req.body);
  if ("error" in validation) {
    return res.status(400).json({ error: validation.error });
  }
  const { tables } = validation;

  const confirmed = (req.body as { confirm?: boolean }).confirm === true;

  const currentTotal = countCurrentRows();
  const incomingTotal = countIncomingRows(tables);

  const isEmpty = incomingTotal === 0;
  const isBigDrop =
    currentTotal > 0 && incomingTotal < currentTotal && (currentTotal - incomingTotal) / currentTotal >= SUSPICIOUS_DROP_RATIO;
  const suspicious = isEmpty || isBigDrop;

  if (suspicious && !confirmed) {
    return res.status(409).json({
      error: isEmpty
        ? `Bu yedek boş (0 kayıt), mevcut veritabanında ${currentTotal} kayıt var. Devam ederseniz ${currentTotal} kayıt silinip boş yedekle değiştirilecek.`
        : `Bu yedek ${incomingTotal} kayıt içeriyor, mevcut veritabanında ${currentTotal} kayıt var. Devam ederseniz ${currentTotal} kayıt silinip ${incomingTotal} kayıtla değiştirilecek.`,
      suspicious: true,
      currentTotal,
      incomingTotal
    });
  }

  let autoBackupFile: string;
  try {
    autoBackupFile = writeAutoBackupBeforeRestore();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return res.status(500).json({
      error: `Güvenlik yedeği alınamadığı için geri yükleme iptal edildi (hiçbir şey değişmedi): ${message}`
    });
  }

  let totalRows = 0;

  try {
    db.exec("BEGIN TRANSACTION");

    for (const table of DELETE_ORDER) {
      db.exec(`DELETE FROM ${table}`);
    }

    for (const table of INSERT_ORDER) {
      const columns = TABLE_COLUMNS[table];
      const rows = tables[table] ?? [];
      if (rows.length === 0) continue;

      const placeholders = columns.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
      );

      for (const row of rows) {
        const r = (row ?? {}) as Record<string, unknown>;
        const values = columns.map((col) => (r[col] === undefined ? null : r[col]));
        stmt.run(...(values as (string | number | null)[]));
        totalRows += 1;
      }
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return res.status(400).json({
      error: `Geri yükleme başarısız, hiçbir değişiklik yapılmadı: ${message}. (Güvenlik yedeği yine de alındı: ${autoBackupFile})`
    });
  }

  logChange(
    "system",
    "update",
    `Yedekten geri yüklendi (${totalRows} kayıt). Öncesinin güvenlik yedeği: ${autoBackupFile}`
  );

  res.json({ ok: true, totalRows, autoBackupFile });
});

export default router;
