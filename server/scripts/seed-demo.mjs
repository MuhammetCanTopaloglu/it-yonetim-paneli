// Tamamen UYDURMA demo verisi üretir (public repo / ekran görüntüsü / deneme için).
//
//   npm run seed:demo                      -> ./demo-data/data/app.db
//   DATA_DIR=baska-klasor npm run seed:demo
//
// GÜVENLİK: Bu script GERÇEK `data/` klasörüne ASLA yazmaz. Hedef (DATA_DIR) gerçek
// data klasörü, proje kökü veya data/ içi çıkarsa hiçbir şey açılmadan hata verip durur.
// IP'ler RFC 5737 dokümantasyon aralıklarındandır (192.0.2.0/24, 198.51.100.0/24,
// 203.0.113.0/24); community string yoktur.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const realDataDir = path.join(repoRoot, "data");

const norm = (p) => path.resolve(p).toLowerCase();
// Göreli DATA_DIR proje köküne göre çözülür (npm --prefix server cwd'yi değiştirdiği için).
const demoRoot = path.resolve(repoRoot, process.env.DATA_DIR ?? "demo-data");
// server/src/db/connection.ts: DATA_DIR verilirse veritabanı <DATA_DIR>/data/app.db'dir.
const effectiveDataDir = path.join(demoRoot, "data");

function refuse(reason) {
  console.error(`[seed-demo] DURDURULDU: ${reason}`);
  console.error(`[seed-demo] Hedef: ${demoRoot}  (veritabanı: ${effectiveDataDir})`);
  console.error("[seed-demo] Gerçek data/ klasörü korunuyor, hiçbir şey yazılmadı.");
  process.exit(1);
}

if (norm(demoRoot) === norm(repoRoot)) refuse("DATA_DIR proje köküne işaret ediyor (veritabanı gerçek data/ olurdu).");
if (norm(effectiveDataDir) === norm(realDataDir)) refuse("Hedef veritabanı klasörü gerçek data/ klasörü.");
if (norm(demoRoot) === norm(realDataDir) || norm(demoRoot).startsWith(norm(realDataDir) + path.sep)) {
  refuse("DATA_DIR gerçek data/ klasörünün kendisi veya içi.");
}

process.env.DATA_DIR = demoRoot;

const { db, dataDir } = await import("../src/db/connection.ts");
if (norm(dataDir) !== norm(effectiveDataDir) || norm(dataDir) === norm(realDataDir)) {
  refuse(`Beklenmeyen veri klasörü çözümlendi: ${dataDir}`);
}
const { runMigrations } = await import("../src/db/migrate.ts");
const { hashPassword } = await import("../src/lib/password.ts");
const { DEFAULT_KDF_PARAMS, generateSalt, deriveKey, createVerifier, encrypt } = await import(
  "../src/lib/vaultCrypto.ts"
);

runMigrations();

const existing = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
if (existing > 0) refuse("Demo veritabanı zaten dolu. Yeniden üretmek için demo klasörünü silin.");

const DEMO_ADMIN = { username: "admin", password: "demo-admin-1234" };
const DEMO_VAULT_PASSWORD = "demo-kasa-1234";

const DAY = 86400000;
const iso = (offsetDays = 0, offsetHours = 0) =>
  new Date(Date.now() + offsetDays * DAY + offsetHours * 3600000).toISOString();
const dateOnly = (offsetDays) => iso(offsetDays).slice(0, 10);
const now = iso();

function ins(table, row) {
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(
    ...cols.map((c) => (row[c] === undefined ? null : row[c]))
  );
  return row.id;
}
const id = () => randomUUID();

db.exec("BEGIN TRANSACTION");
try {
  // --- Kullanıcı ---------------------------------------------------------------
  ins("users", {
    id: id(), username: DEMO_ADMIN.username, password_hash: hashPassword(DEMO_ADMIN.password),
    role: "admin", failed_attempts: 0, locked_until: null, created_at: now, updated_at: now
  });

  // --- Subnet'ler + VLAN -------------------------------------------------------
  const subMgmt = ins("subnets", { id: id(), name: "Yönetim", cidr: "192.0.2.0/24", vlan_id: 10, description: "Switch ve sunucu yönetim ağı", created_at: now });
  const subUsers = ins("subnets", { id: id(), name: "Kullanıcı / Kamera", cidr: "198.51.100.0/24", vlan_id: 20, description: "Uç cihazlar, yazıcı, kamera, AP", created_at: now });
  ins("subnets", { id: id(), name: "Misafir", cidr: "203.0.113.0/24", vlan_id: 30, description: "Misafir Wi-Fi (izole)", created_at: now });

  // --- Envanter ----------------------------------------------------------------
  const inv = {};
  const addInv = (key, name, type, model, serial, ip, location, status, purchase, warranty, notes) => {
    inv[key] = ins("inventory", {
      id: id(), name, type, brand_model: model, serial_no: serial, ip_address: ip, location, status,
      purchase_date: purchase, warranty_until: warranty, notes, created_at: now, updated_at: now
    });
  };
  addInv("app", "SRV-App-01", "Sunucu", "Example Server R200", "DEMO-SRV-0001", "192.0.2.50", "Sunucu odası", "aktif", dateOnly(-700), dateOnly(400), "Uygulama sunucusu");
  addInv("bak", "SRV-Backup-01", "Sunucu", "Example Server R200", "DEMO-SRV-0002", "192.0.2.51", "Sunucu odası", "aktif", dateOnly(-1050), dateOnly(45), "Yedekleme sunucusu — garanti yakında bitiyor");
  addInv("prn1", "PRN-Kat1", "Yazıcı", "Example LaserJet 400", "DEMO-PRN-0001", "198.51.100.20", "Kat 1", "aktif", dateOnly(-300), dateOnly(430), null);
  addInv("prn2", "PRN-Yedek", "Yazıcı", "Example LaserJet 400", "DEMO-PRN-0002", null, "Depo", "yedek", dateOnly(-500), dateOnly(230), "Yedek cihaz");
  addInv("cam1", "CAM-Giris", "Kamera", "Example Cam 4MP", "DEMO-CAM-0001", "198.51.100.31", "Ana giriş", "aktif", dateOnly(-400), dateOnly(330), null);
  addInv("cam2", "CAM-Otopark", "Kamera", "Example Cam 4MP", "DEMO-CAM-0002", "198.51.100.32", "Otopark", "arizali", dateOnly(-400), dateOnly(330), "Görüntü gelmiyor, kablo kontrol edilecek");
  addInv("ap1", "AP-Lobi", "Access Point", "Example AP Wi-Fi 6", "DEMO-AP-0001", "198.51.100.41", "Lobi", "aktif", dateOnly(-200), dateOnly(530), null);
  addInv("ap2", "AP-Kat2", "Access Point", "Example AP Wi-Fi 6", "DEMO-AP-0002", "198.51.100.42", "Kat 2", "aktif", dateOnly(-200), dateOnly(530), null);
  addInv("pc", "PC-Eski-01", "Masaüstü", "Example Desk 3000", "DEMO-PC-0001", null, "Depo", "hurda", dateOnly(-1900), dateOnly(-200), "Garantisi dolmuş, hurdaya ayrıldı");

  // --- Switch'ler --------------------------------------------------------------
  const sw = {};
  const swDefs = [
    ["core", "SW-Core-01", "Example Core 24X", "192.0.2.1", 24, 4, "Sunucu odası", 400, 40, 1],
    ["distA", "SW-Dist-A", "Example Dist 24G", "192.0.2.2", 24, 4, "Kat 1 pano", 160, 230, 0],
    ["distB", "SW-Dist-B", "Example Dist 24G", "192.0.2.3", 24, 4, "Kat 2 pano", 640, 230, 0],
    ["acc1", "SW-Access-01", "Example Access 24", "192.0.2.11", 24, 2, "Kat 1 oda 101", 40, 430, 0],
    ["acc2", "SW-Access-02", "Example Access 24", "192.0.2.12", 24, 2, "Kat 1 oda 105", 280, 430, 0],
    ["acc3", "SW-Access-03", "Example Access 24", "192.0.2.13", 24, 2, "Kat 2 oda 201", 560, 430, 0]
  ];
  for (const [key, name, model, ip, copper, sfp, location, x, y, backbone] of swDefs) {
    sw[key] = { id: ins("switches", {
      id: id(), name, model, management_ip: ip, port_count: copper, sfp_count: sfp,
      vlans: "10,20,30", location, notes: null, pos_x: x, pos_y: y, snmp_community: null,
      is_backbone: backbone, created_at: now, updated_at: now
    }), copper, sfp };
    for (let n = 1; n <= copper + sfp; n++) {
      ins("switch_ports", {
        id: id(), switch_id: sw[key].id, port_number: n, port_type: n <= copper ? "copper" : "sfp",
        label: null, status: "bos", connection_type: null, connected_inventory_id: null,
        connected_switch_id: null, connected_port_number: null, connected_label: null,
        vlan: null, notes: null, created_at: now, updated_at: now
      });
    }
  }

  const updPort = db.prepare(
    `UPDATE switch_ports SET label = ?, status = ?, connection_type = ?, connected_inventory_id = ?, connected_switch_id = ?,
       connected_port_number = ?, connected_label = ?, vlan = ?, updated_at = ? WHERE switch_id = ? AND port_number = ?`
  );
  const sfpPort = (key, i) => sw[key].copper + i; // i = 1..sfp
  function uplink(a, aPort, b, bPort, label) {
    updPort.run(label, "uplink", "switch", null, sw[b].id, bPort, swNames[b], "10", now, sw[a].id, aPort);
    updPort.run(label, "uplink", "switch", null, sw[a].id, aPort, swNames[a], "10", now, sw[b].id, bPort);
    ins("switch_links", { id: id(), source_id: sw[a].id, target_id: sw[b].id, label, created_at: now });
  }
  const swNames = Object.fromEntries(swDefs.map((d) => [d[0], d[1]]));

  uplink("core", sfpPort("core", 1), "distA", sfpPort("distA", 1), "10G uplink");
  uplink("core", sfpPort("core", 2), "distB", sfpPort("distB", 1), "10G uplink");
  uplink("distA", sfpPort("distA", 2), "acc1", sfpPort("acc1", 1), "1G uplink");
  uplink("distA", sfpPort("distA", 3), "acc2", sfpPort("acc2", 1), "1G uplink");
  uplink("distB", sfpPort("distB", 2), "acc3", sfpPort("acc3", 1), "1G uplink");
  // Yedekli yol: SW-Access-02 ikinci uplink ile SW-Dist-B'ye de bağlı (etki analizi demosu).
  uplink("acc2", sfpPort("acc2", 2), "distB", sfpPort("distB", 3), "1G yedek uplink");

  // Uç cihaz bağlantıları (dolu portlar) + bir kapalı + bir etiketli boş port.
  const dev = (key, port, invKey, label, vlan) =>
    updPort.run(label, "dolu", "inventory", inv[invKey], null, null, label, vlan, now, sw[key].id, port);
  dev("core", 1, "app", "SRV-App-01", "10");
  dev("core", 2, "bak", "SRV-Backup-01", "10");
  dev("acc1", 1, "ap1", "AP-Lobi", "20");
  dev("acc1", 2, "cam1", "CAM-Giris", "20");
  dev("acc1", 3, "prn1", "PRN-Kat1", "20");
  dev("acc2", 1, "cam2", "CAM-Otopark", "20");
  dev("acc3", 1, "ap2", "AP-Kat2", "20");
  for (let n = 4; n <= 9; n++) {
    updPort.run(`Oda 10${n} duvar prizi`, "dolu", "other", null, null, null, `Kullanıcı PC (Oda 10${n})`, "20", now, sw.acc1.id, n);
  }
  updPort.run("Kullanılmıyor", "kapali", null, null, null, null, null, null, now, sw.acc2.id, 24);
  updPort.run("Rezerve — toplantı odası", "bos", null, null, null, null, null, "20", now, sw.acc3.id, 10);

  // --- IP planı ----------------------------------------------------------------
  const ipRow = (subnet, ip, name, invKey, status, notes) =>
    ins("ip_assignments", {
      id: id(), subnet_id: subnet, ip_address: ip, device_name: name, inventory_id: invKey ? inv[invKey] : null,
      status, notes: notes ?? null, created_at: now, updated_at: now
    });
  for (const d of swDefs) ipRow(subMgmt, d[3], d[1], null, "kullanimda", "Switch yönetim IP'si");
  ipRow(subMgmt, "192.0.2.50", "SRV-App-01", "app", "kullanimda");
  ipRow(subMgmt, "192.0.2.51", "SRV-Backup-01", "bak", "kullanimda");
  ipRow(subMgmt, "192.0.2.60", null, null, "rezerve", "Gelecek sunucu için ayrıldı");
  ipRow(subUsers, "198.51.100.20", "PRN-Kat1", "prn1", "kullanimda");
  ipRow(subUsers, "198.51.100.31", "CAM-Giris", "cam1", "kullanimda");
  ipRow(subUsers, "198.51.100.32", "CAM-Otopark", "cam2", "kullanimda", "Arızalı");
  ipRow(subUsers, "198.51.100.41", "AP-Lobi", "ap1", "kullanimda");
  ipRow(subUsers, "198.51.100.42", "AP-Kat2", "ap2", "kullanimda");
  ipRow(subUsers, "198.51.100.100", null, null, "bos");

  // --- Topoloji annotation'ları ---------------------------------------------------
  ins("topology_annotations", { id: id(), type: "region", x: 300, y: -10, width: 330, height: 150, text: "Sunucu Odası", color: "#3b82f6", shape_kind: null, z_order: 0, created_at: now, updated_at: now });
  ins("topology_annotations", { id: id(), type: "region", x: 20, y: 390, width: 480, height: 150, text: "Kat 1 — Erişim", color: "#22c55e", shape_kind: null, z_order: 0, created_at: now, updated_at: now });
  ins("topology_annotations", { id: id(), type: "text", x: 600, y: 520, width: null, height: null, text: "Demo topoloji — tüm veriler uydurmadır", color: null, shape_kind: null, z_order: 1, created_at: now, updated_at: now });

  // --- Görevler (3 kanban sütunu) ---------------------------------------------------
  let order = 0;
  const todo = (title, description, priority, due, status, invKey) =>
    ins("todos", {
      id: id(), title, description, priority, due_date: due, status,
      related_inventory_id: invKey ? inv[invKey] : null, sort_order: order++, created_at: now, updated_at: now
    });
  todo("CAM-Otopark kablosunu kontrol et", "Görüntü gelmiyor; patch kablo ve PoE portu kontrol edilecek.", "yuksek", dateOnly(-1), "bekliyor", "cam2");
  todo("SRV-Backup-01 garanti yenileme teklifi iste", null, "orta", dateOnly(20), "bekliyor", "bak");
  todo("Misafir Wi-Fi şifresini döndür", "Üç ayda bir yenileniyor.", "dusuk", dateOnly(30), "bekliyor", null);
  todo("SW-Access-03 firmware güncellemesi", "Bakım penceresinde yapılacak.", "orta", dateOnly(5), "devam_ediyor", null);
  todo("Yazıcı sürücü paketini hazırla", null, "dusuk", null, "devam_ediyor", "prn1");
  todo("VLAN planını dokümante et", "Topoloji notlarına eklendi.", "orta", dateOnly(-10), "tamam", null);
  todo("AP-Lobi kanal ayarlarını optimize et", null, "dusuk", dateOnly(-4), "tamam", "ap1");

  // --- Notlar ------------------------------------------------------------------------
  ins("notes", { id: id(), title: "Runbook: Switch yapılandırma yedeği", tags: "runbook,switch", created_at: now, updated_at: now, content:
`# Switch yapılandırma yedeği

Aylık bakımda her switch için çalışan yapılandırma yedeklenir.

## Adımlar
1. Yönetim ağına bağlan (VLAN 10, \`192.0.2.0/24\`).
2. Switch'e SSH ile gir.
3. Çalışan yapılandırmayı dışa aktar:
   \`\`\`
   show running-config
   \`\`\`
4. Çıktıyı \`switch-adi-YYYYMMDD.cfg\` olarak yedek paylaşımına kaydet.
5. Değişiklik günlüğüne kısa bir not düş.

> Not: Bu bir demo notudur, gerçek cihazlarla ilgisi yoktur.
` });
  ins("notes", { id: id(), title: "Ağ yapısı özeti", tags: "dokümantasyon", created_at: now, updated_at: now, content:
`# Ağ yapısı özeti

| VLAN | Ad | Subnet |
|------|----|--------|
| 10 | Yönetim | 192.0.2.0/24 |
| 20 | Kullanıcı / Kamera | 198.51.100.0/24 |
| 30 | Misafir | 203.0.113.0/24 |

- **SW-Core-01** omurgadır; Dist-A ve Dist-B ona 10G uplink ile bağlıdır.
- **SW-Access-02** yedekli yola sahiptir (Dist-A + Dist-B).
` });

  // --- Kimlik kasası (demo ana parola) + lisanslar ---------------------------------------
  const salt = generateSalt();
  const key = deriveKey(DEMO_VAULT_PASSWORD, salt, DEFAULT_KDF_PARAMS);
  ins("vault_meta", {
    id: "main", salt, kdf_n: DEFAULT_KDF_PARAMS.N, kdf_r: DEFAULT_KDF_PARAMS.r, kdf_p: DEFAULT_KDF_PARAMS.p,
    verifier: createVerifier(key), failed_attempts: 0, locked_until: null, created_at: now
  });
  ins("vault_credentials", {
    id: id(), target_type: "switch", target_id: sw.core.id, label: "SW-Core-01 — konsol erişimi",
    username_encrypted: encrypt(key, "demo-admin"), password_encrypted: encrypt(key, "demo-console-pass"),
    notes_encrypted: encrypt(key, "Uydurma demo kimlik bilgisi"), created_at: now, updated_at: now
  });

  const lic = (name, vendor, seats, purchase, start, renewal, cost, keyText, notes) =>
    ins("licenses", {
      id: id(), product_name: name, vendor, total_seats: seats, purchase_date: purchase, start_date: start,
      renewal_date: renewal, cost, currency: "USD", license_key_encrypted: encrypt(key, keyText), notes,
      created_at: now, updated_at: now
    });
  const assign = (licId, labels, type = "other") =>
    labels.forEach((l) =>
      ins("license_assignments", { id: id(), license_id: licId, target_type: type, target_id: null, assigned_label: l, assigned_at: now, notes: null })
    );

  const lBackup = lic("Demo Backup Pro", "Example Software Inc.", 10, dateOnly(-356), dateOnly(-356), dateOnly(9), 1200, "DEMO-BKUP-0000-0001", "Yenileme ACİL (14 günden az)");
  assign(lBackup, ["SRV-App-01", "SRV-Backup-01", "Muhasebe sunucusu", "Test sunucusu"]);
  const lMon = lic("Demo Monitoring Suite", "Sample Systems Ltd.", 3, dateOnly(-324), dateOnly(-324), dateOnly(41), 540, "DEMO-MON-0000-0002", "Yenileme yaklaşıyor (60 günden az)");
  assign(lMon, ["NOC ekranı"]);
  const lAv = lic("Demo Endpoint Antivirus", "Example Software Inc.", 5, dateOnly(-165), dateOnly(-165), dateOnly(200), 350, "DEMO-AV-0000-0003", "Tüm koltuklar dolu");
  assign(lAv, ["Kullanıcı A", "Kullanıcı B", "Kullanıcı C", "Kullanıcı D", "Kullanıcı E"]);
  const lVpn = lic("Demo VPN Gateway", "Sample Systems Ltd.", 2, dateOnly(-377), dateOnly(-377), dateOnly(-12), 220, "DEMO-VPN-0000-0004", "Yenileme tarihi GEÇTİ");
  assign(lVpn, ["Uzaktan çalışma grubu"]);
  const lOffice = lic("Demo Office Suite", "Example Software Inc.", 25, dateOnly(-100), dateOnly(-100), dateOnly(265), 2750, "DEMO-OFF-0000-0005", null);
  assign(lOffice, ["Muhasebe", "İnsan Kaynakları", "Satış"]);

  // --- Değişiklik günlüğü ---------------------------------------------------------------
  const log = (table, action, desc, hoursAgo) =>
    ins("changelog", { id: id(), table_name: table, record_id: null, action, description: desc, created_at: iso(0, -hoursAgo) });
  log("switches", "create", `"SW-Core-01" eklendi`, 72);
  log("switch_links", "create", "SW-Core-01 ↔ SW-Dist-A bağlantısı eklendi", 70);
  log("inventory", "update", `"CAM-Otopark" durumu arızalı olarak güncellendi`, 24);
  log("licenses", "create", `"Demo Backup Pro" lisansı eklendi`, 8);
  log("todos", "create", `"CAM-Otopark kablosunu kontrol et" görevi eklendi`, 3);

  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  console.error("[seed-demo] Hata, işlem geri alındı:", err);
  process.exit(1);
}

const counts = Object.fromEntries(
  ["switches", "switch_ports", "switch_links", "inventory", "subnets", "ip_assignments", "licenses", "license_assignments", "notes", "todos", "topology_annotations"].map(
    (t) => [t, db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c]
  )
);
console.log("[seed-demo] Tamamlandı:", JSON.stringify(counts));
console.log(`[seed-demo] Veritabanı: ${path.join(dataDir, "app.db")}`);
console.log("[seed-demo] YALNIZCA DEMO — giriş: admin / demo-admin-1234 · kasa ana parolası: demo-kasa-1234");
console.log(`[seed-demo] Başlatmak için (PowerShell, proje kökünden):  $env:DATA_DIR="${demoRoot}"; npm run dev`);
console.log(`[seed-demo] Başlatmak için (bash, proje kökünden):        DATA_DIR="${demoRoot}" npm run dev`);
