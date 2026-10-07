CREATE TABLE IF NOT EXISTS switches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT,
  management_ip TEXT,
  port_count INTEGER,
  sfp_count INTEGER NOT NULL DEFAULT 0,
  vlans TEXT,
  location TEXT,
  notes TEXT,
  pos_x REAL NOT NULL DEFAULT 0,
  pos_y REAL NOT NULL DEFAULT 0,
  -- SNMP v2c community string (düz metin, hassas) — /api/switches
  -- yanıtlarında ASLA döndürülmez, sadece /api/snmp/query içeride okur.
  snmp_community TEXT,
  -- Etki analizi (blast radius) için omurga işareti — birden fazla switch
  -- omurga olabilir (yedekli omurga senaryosu, çoklu-kaynak BFS).
  is_backbone INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS switch_links (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES switches(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES switches(id) ON DELETE CASCADE,
  label TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  brand_model TEXT,
  serial_no TEXT,
  ip_address TEXT,
  location TEXT,
  status TEXT NOT NULL CHECK (status IN ('aktif', 'arizali', 'yedek', 'hurda')),
  purchase_date TEXT,
  warranty_until TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subnets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cidr TEXT NOT NULL,
  vlan_id INTEGER,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ip_assignments (
  id TEXT PRIMARY KEY,
  subnet_id TEXT REFERENCES subnets(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  device_name TEXT,
  inventory_id TEXT REFERENCES inventory(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('kullanimda', 'bos', 'rezerve')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('dusuk', 'orta', 'yuksek')),
  due_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('bekliyor', 'devam_ediyor', 'tamam')),
  related_inventory_id TEXT REFERENCES inventory(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tags TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS switch_ports (
  id TEXT PRIMARY KEY,
  switch_id TEXT NOT NULL REFERENCES switches(id) ON DELETE CASCADE,
  port_number INTEGER NOT NULL,
  port_type TEXT NOT NULL DEFAULT 'copper' CHECK (port_type IN ('copper', 'sfp')),
  label TEXT,
  status TEXT NOT NULL CHECK (status IN ('bos', 'dolu', 'kapali', 'uplink')),
  connection_type TEXT CHECK (connection_type IN ('inventory', 'switch', 'other')),
  connected_inventory_id TEXT REFERENCES inventory(id) ON DELETE SET NULL,
  connected_switch_id TEXT REFERENCES switches(id) ON DELETE SET NULL,
  connected_port_number INTEGER,
  connected_label TEXT,
  vlan TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (switch_id, port_number)
);

-- Fatura = bir ek dosya (genelde PDF) + birkaç ekstra alan. Ayrı bir
-- "invoices" kavramı yerine attachments genişletildi — is_invoice=0 olan
-- normal ekler (ör. bir ekran görüntüsü) bu alanları hiç kullanmaz, NULL
-- kalır. is_invoice=1 olanlarda tutar/tedarikçi/tarih girilebilir.
CREATE TABLE IF NOT EXISTS attachments (
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
);

CREATE TABLE IF NOT EXISTS changelog (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topology_annotations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('region', 'text', 'shape')),
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL,
  height REAL,
  text TEXT,
  color TEXT,
  shape_kind TEXT CHECK (shape_kind IN ('box', 'arrow')),
  z_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Kimlik Bilgileri Kasası — tek satırlık meta kayıt (id sabit 'main').
-- Ana parolanın KENDİSİ/hash'i HİÇBİR ZAMAN burada tutulmaz — sadece salt
-- (anahtar türetmek için) ve verifier (rastgele bir token'ın şifreli hali,
-- doğru anahtarla çözülüp çözülemediğine bakılarak parola doğrulanır).
-- Bkz. lib/vaultCrypto.ts.
CREATE TABLE IF NOT EXISTS vault_meta (
  id TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  kdf_n INTEGER NOT NULL,
  kdf_r INTEGER NOT NULL,
  kdf_p INTEGER NOT NULL,
  verifier TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL
);

-- Kimlik bilgisi kayıtları. username/password/notes HER ZAMAN şifreli
-- ("iv:authTag:ciphertext", bkz. lib/vaultCrypto.ts) — düz metin hiçbir
-- zaman buraya yazılmaz. `label` bilerek şifresiz: hassas değil, sadece
-- "hangi kayıt bu" bilgisini taşır, kasa kilitliyken bile listelenebilsin
-- diye (ama LIST endpoint'i kasa kilitliyken de zaten çalışır, şifreli
-- alanları döndürmez).
CREATE TABLE IF NOT EXISTS vault_credentials (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('switch', 'inventory', 'other')),
  target_id TEXT,
  label TEXT NOT NULL,
  username_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  notes_encrypted TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_credentials_target ON vault_credentials(target_type, target_id);

-- Lisans Yönetimi — donanım envanterinden AYRI bir modül. Liste/CRUD kasa
-- kilitliyken de çalışır (license_key_encrypted hariç her alan düz metin);
-- sadece anahtarı ŞİFRELİ tutmak için kasanın AES-256-GCM anahtarını
-- yeniden kullanıyoruz (bkz. lib/vaultCrypto.ts) — ikinci bir kripto/parola
-- sistemi YOK. license_key_encrypted NULL olabilir (henüz anahtar
-- girilmemiş VEYA kasa kilitliyken oluşturulmuş bir kayıt).
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  vendor TEXT,
  total_seats INTEGER NOT NULL DEFAULT 1,
  purchase_date TEXT,
  start_date TEXT,
  renewal_date TEXT,
  cost REAL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  license_key_encrypted TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Koltuk ataması — IP havuzu/kasa hedef desenindeki gibi POLİMORFİK
-- (target_id gerçek bir FK değil, switches/inventory silinince elle
-- unlinkLicenseAssignmentsTarget() ile target_id=NULL yapılır, bkz.
-- lib/licenseLink.ts). "Kaç koltuk kullanılıyor" = bu tablodaki
-- license_id'ye ait satır sayısı; "boş" = total_seats - kullanılan.
CREATE TABLE IF NOT EXISTS license_assignments (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('inventory', 'switch', 'other')),
  target_id TEXT,
  assigned_label TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_license_assignments_license ON license_assignments(license_id);
CREATE INDEX IF NOT EXISTS idx_license_assignments_target ON license_assignments(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_switch_links_source ON switch_links(source_id);
CREATE INDEX IF NOT EXISTS idx_switch_links_target ON switch_links(target_id);
CREATE INDEX IF NOT EXISTS idx_ip_assignments_subnet ON ip_assignments(subnet_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_changelog_created_at ON changelog(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_switch_ports_switch ON switch_ports(switch_id);
