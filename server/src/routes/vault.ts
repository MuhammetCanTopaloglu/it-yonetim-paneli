import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { SESSION_COOKIE_NAME, requireAdmin } from "./auth.js";
import { logChange } from "../lib/changelog.js";
import { checkMasterPasswordStrength } from "../lib/masterPasswordStrength.js";
import {
  DEFAULT_KDF_PARAMS,
  createVerifier,
  checkVerifier,
  deriveKey,
  generateSalt,
  encrypt,
  decrypt,
  DecryptionError
} from "../lib/vaultCrypto.js";
import { getVaultKey, isVaultUnlocked, lockVaultSession, unlockVaultSession } from "../lib/vaultSession.js";
import type { VaultCredential, VaultCredentialTargetType, VaultMeta } from "../types.js";

const router = Router();

const VAULT_META_ID = "main";
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

// Bu router index.ts'de hem requireAuth (global) hem requireAdmin ARDINDAN
// mount edilir — kasaya sadece admin erişebilir (plandaki karar, rol bazlı
// ince ayar ileride eklenebilir şekilde tek bir requireAdmin noktası).
router.use(requireAdmin);

function getAppSessionId(req: import("express").Request): string {
  // requireAuth zaten cookie'nin varlığını doğruladı (bu router'a gelmeden
  // önce çalışır) — burada sadece okunuyor.
  return req.cookies[SESSION_COOKIE_NAME] as string;
}

function getVaultMeta(): VaultMeta | undefined {
  return db.prepare(`SELECT * FROM vault_meta WHERE id = ?`).get(VAULT_META_ID) as VaultMeta | undefined;
}

/** unlock VE change-master-password PAYLAŞIYOR — ikisi de "ana parola deneme" sayılır, aynı kilitleme sayacına tabi. */
function lockoutRemainingMinutes(meta: VaultMeta): number | null {
  if (!meta.locked_until) return null;
  const remainingMs = new Date(meta.locked_until).getTime() - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 60000) : null;
}

function registerFailedAttempt(meta: VaultMeta): { locked: boolean } {
  const attempts = meta.failed_attempts + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
    db.prepare(`UPDATE vault_meta SET failed_attempts = 0, locked_until = ? WHERE id = ?`).run(
      lockedUntil,
      VAULT_META_ID
    );
    return { locked: true };
  }
  db.prepare(`UPDATE vault_meta SET failed_attempts = ? WHERE id = ?`).run(attempts, VAULT_META_ID);
  return { locked: false };
}

function clearFailedAttempts(): void {
  db.prepare(`UPDATE vault_meta SET failed_attempts = 0, locked_until = NULL WHERE id = ?`).run(VAULT_META_ID);
}

router.get("/status", (req, res) => {
  const meta = getVaultMeta();
  const sessionId = getAppSessionId(req);

  if (!meta) {
    return res.json({ exists: false, unlocked: false, locked: false, lockedUntil: null });
  }

  const now = Date.now();
  const locked = !!meta.locked_until && new Date(meta.locked_until).getTime() > now;

  res.json({
    exists: true,
    unlocked: isVaultUnlocked(sessionId),
    locked,
    lockedUntil: locked ? meta.locked_until : null
  });
});

router.post("/setup", (req, res) => {
  if (getVaultMeta()) {
    return res.status(409).json({ error: "Kasa zaten kurulmuş" });
  }

  const { masterPassword, acknowledged } = (req.body ?? {}) as {
    masterPassword?: string;
    acknowledged?: boolean;
  };

  if (!masterPassword) {
    return res.status(400).json({ error: "Ana parola gerekli" });
  }
  if (!acknowledged) {
    return res
      .status(400)
      .json({ error: "Ana parolanın unutulursa kurtarılamayacağını onaylamanız gerekiyor" });
  }

  const strength = checkMasterPasswordStrength(masterPassword);
  if (!strength.ok) {
    return res.status(400).json({ error: strength.reason });
  }

  const salt = generateSalt();
  const key = deriveKey(masterPassword, salt, DEFAULT_KDF_PARAMS);
  const verifier = createVerifier(key);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO vault_meta (id, salt, kdf_n, kdf_r, kdf_p, verifier, failed_attempts, locked_until, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`
  ).run(VAULT_META_ID, salt, DEFAULT_KDF_PARAMS.N, DEFAULT_KDF_PARAMS.r, DEFAULT_KDF_PARAMS.p, verifier, now);

  // Kurulumdan hemen sonra kasa zaten "açık" sayılır — kullanıcı aynı parolayı
  // ikinci kez girmek zorunda kalmasın.
  unlockVaultSession(getAppSessionId(req), key);

  res.status(201).json({ ok: true });
});

router.post("/unlock", (req, res) => {
  const meta = getVaultMeta();
  if (!meta) {
    return res.status(404).json({ error: "Kasa henüz kurulmamış" });
  }

  const remainingMin = lockoutRemainingMinutes(meta);
  if (remainingMin !== null) {
    return res
      .status(429)
      .json({ error: `Çok fazla başarısız deneme. ${remainingMin} dakika sonra tekrar deneyin.` });
  }

  const { masterPassword } = (req.body ?? {}) as { masterPassword?: string };
  if (!masterPassword) {
    return res.status(400).json({ error: "Ana parola gerekli" });
  }

  const key = deriveKey(masterPassword, meta.salt, {
    N: meta.kdf_n,
    r: meta.kdf_r,
    p: meta.kdf_p
  });

  if (!checkVerifier(key, meta.verifier)) {
    const { locked } = registerFailedAttempt(meta);
    if (locked) {
      return res
        .status(429)
        .json({ error: `Çok fazla başarısız deneme. ${LOCK_MINUTES} dakika sonra tekrar deneyin.` });
    }
    return res.status(401).json({
      error: `Ana parola yanlış (kalan deneme: ${MAX_FAILED_ATTEMPTS - meta.failed_attempts - 1})`
    });
  }

  clearFailedAttempts();
  unlockVaultSession(getAppSessionId(req), key);

  res.json({ ok: true });
});

router.post("/lock", (req, res) => {
  lockVaultSession(getAppSessionId(req));
  res.status(204).send();
});

// Ana parola değiştirme — EN RİSKLİ işlem: yarıda kalırsa kasa
// yarı-eski-yarı-yeni parolayla bozuk kalabilir. İki katmanlı güvence:
//  1) Tüm kayıtlar ESKİ anahtarla ÖNCE (yazma başlamadan, salt-okunur)
//     çözülür. Herhangi biri çözülemezse hiçbir şey yazılmadan hata
//     döner — kasa tamamen dokunulmamış kalır.
//  2) Çözme tamamen başarılıysa, yeni salt/anahtar/verifier + tüm
//     kayıtların yeniden şifrelenmiş hâli TEK bir DB transaction'ında
//     yazılır — yazma sırasında beklenmeyen bir hata olursa ROLLBACK,
//     eski salt/verifier/şifreli veri aynen kalır (eski parola hâlâ çalışır).
router.post("/change-master-password", (req, res) => {
  const meta = getVaultMeta();
  if (!meta) {
    return res.status(404).json({ error: "Kasa henüz kurulmamış" });
  }

  const remainingMin = lockoutRemainingMinutes(meta);
  if (remainingMin !== null) {
    return res
      .status(429)
      .json({ error: `Çok fazla başarısız deneme. ${remainingMin} dakika sonra tekrar deneyin.` });
  }

  const { oldPassword, newPassword } = (req.body ?? {}) as { oldPassword?: string; newPassword?: string };
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Mevcut ve yeni ana parola gerekli" });
  }

  const strength = checkMasterPasswordStrength(newPassword);
  if (!strength.ok) {
    return res.status(400).json({ error: strength.reason });
  }

  const oldKey = deriveKey(oldPassword, meta.salt, { N: meta.kdf_n, r: meta.kdf_r, p: meta.kdf_p });
  if (!checkVerifier(oldKey, meta.verifier)) {
    const { locked } = registerFailedAttempt(meta);
    if (locked) {
      return res
        .status(429)
        .json({ error: `Çok fazla başarısız deneme. ${LOCK_MINUTES} dakika sonra tekrar deneyin.` });
    }
    return res.status(401).json({
      error: `Mevcut ana parola yanlış (kalan deneme: ${MAX_FAILED_ATTEMPTS - meta.failed_attempts - 1})`
    });
  }
  clearFailedAttempts();

  const allCredentials = db.prepare(`SELECT * FROM vault_credentials`).all() as unknown as VaultCredential[];

  // 1) ÖNCE, hiçbir şey yazmadan: her kaydı eski anahtarla çöz. Biri bile
  // başarısız olursa burada durur — kasa hâlâ eski hâliyle bozulmamış.
  let decrypted: { id: string; username: string; password: string; notes: string | null }[];
  try {
    decrypted = allCredentials.map((row) => ({
      id: row.id,
      username: decrypt(oldKey, row.username_encrypted),
      password: decrypt(oldKey, row.password_encrypted),
      notes: row.notes_encrypted ? decrypt(oldKey, row.notes_encrypted) : null
    }));
  } catch (err) {
    if (err instanceof DecryptionError) {
      return res.status(500).json({
        error: "Bir veya daha fazla kayıt mevcut anahtarla çözülemedi — ana parola DEĞİŞTİRİLMEDİ, hiçbir şey bozulmadı"
      });
    }
    throw err;
  }

  const newSalt = generateSalt();
  const newKey = deriveKey(newPassword, newSalt, DEFAULT_KDF_PARAMS);
  const newVerifier = createVerifier(newKey);
  const now = new Date().toISOString();

  try {
    db.exec("BEGIN TRANSACTION");

    db.prepare(
      `UPDATE vault_meta SET salt = ?, kdf_n = ?, kdf_r = ?, kdf_p = ?, verifier = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?`
    ).run(newSalt, DEFAULT_KDF_PARAMS.N, DEFAULT_KDF_PARAMS.r, DEFAULT_KDF_PARAMS.p, newVerifier, VAULT_META_ID);

    const updateStmt = db.prepare(
      `UPDATE vault_credentials SET username_encrypted = ?, password_encrypted = ?, notes_encrypted = ?, updated_at = ? WHERE id = ?`
    );
    for (const d of decrypted) {
      // encrypt() HER ÇAĞRIDA taze IV üretir — yeniden şifrelenen HİÇBİR
      // kayıt eski IV'sini korumaz.
      updateStmt.run(
        encrypt(newKey, d.username),
        encrypt(newKey, d.password),
        d.notes ? encrypt(newKey, d.notes) : null,
        now,
        d.id
      );
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return res.status(500).json({
      error: `Ana parola değiştirilemedi, hiçbir şey değişmedi: ${message}`
    });
  }

  // Kullanıcı bu istekte hem eski hem yeni parolayı zaten doğru girdi —
  // tekrar unlock istemek gereksiz sürtünme olurdu, kasa yeni anahtarla
  // açık kalır (aynı desen: setup sonrası da otomatik açık kalıyor).
  unlockVaultSession(getAppSessionId(req), newKey);

  logChange("vault_meta", "update", "Ana parola değiştirildi", VAULT_META_ID);

  res.json({ ok: true, reencryptedCount: decrypted.length });
});

// ---------------------------------------------------------------------
// Kimlik Bilgisi Kayıtları (vault_credentials) — Aşama 2
// ---------------------------------------------------------------------

const TARGET_TYPES: VaultCredentialTargetType[] = ["switch", "inventory", "other"];

function getUnlockedKeyOr423(req: import("express").Request, res: import("express").Response): Buffer | null {
  const key = getVaultKey(getAppSessionId(req));
  if (!key) {
    res.status(423).json({ error: "Kasa kilitli — önce ana parolayla açın" });
    return null;
  }
  return key;
}

function toPublicShape(row: VaultCredential) {
  return {
    id: row.id,
    target_type: row.target_type,
    target_id: row.target_id,
    label: row.label,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// LIST — şifreli alanlar (username_encrypted/password_encrypted/notes_encrypted)
// SEÇİLMİYOR bile (SELECT'te yok) — ne şifreli ne çözülmüş biçimde asla
// listeye sızmaz. Kasa kilitliyken de bilerek çalışmıyor (423) — "kaç/hangi
// kayıt var" bilgisi bile ana parola girilmeden görünmesin diye.
router.get("/credentials", (req, res) => {
  if (!getUnlockedKeyOr423(req, res)) return;

  const rows = db
    .prepare(
      `SELECT id, target_type, target_id, label, created_at, updated_at
       FROM vault_credentials ORDER BY label COLLATE NOCASE ASC`
    )
    .all();
  res.json(rows);
});

router.post("/credentials", (req, res) => {
  const key = getUnlockedKeyOr423(req, res);
  if (!key) return;

  const { target_type, target_id, label, username, password, notes } = (req.body ?? {}) as {
    target_type?: string;
    target_id?: string | null;
    label?: string;
    username?: string;
    password?: string;
    notes?: string | null;
  };

  if (!target_type || !TARGET_TYPES.includes(target_type as VaultCredentialTargetType)) {
    return res.status(400).json({ error: "Geçersiz target_type" });
  }
  if (!label || !label.trim()) {
    return res.status(400).json({ error: "label zorunludur" });
  }
  if (!username || !password) {
    return res.status(400).json({ error: "username ve password zorunludur" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO vault_credentials
       (id, target_type, target_id, label, username_encrypted, password_encrypted, notes_encrypted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    target_type,
    target_id ?? null,
    label.trim(),
    encrypt(key, username),
    encrypt(key, password),
    notes ? encrypt(key, notes) : null,
    now,
    now
  );

  // KRİTİK: logChange'e asla kullanıcı adı/şifre/not METNİ gitmiyor — sadece
  // düz metin `label` (hassas değil) ve olay adı.
  logChange("vault_credentials", "create", `"${label.trim()}" için kimlik bilgisi eklendi`, id);

  const row = db.prepare(`SELECT * FROM vault_credentials WHERE id = ?`).get(id) as unknown as VaultCredential;
  res.status(201).json(toPublicShape(row));
});

router.put("/credentials/:id", (req, res) => {
  const key = getUnlockedKeyOr423(req, res);
  if (!key) return;

  const existing = db.prepare(`SELECT * FROM vault_credentials WHERE id = ?`).get(req.params.id) as
    | VaultCredential
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const { target_type, target_id, label, username, password, notes } = (req.body ?? {}) as {
    target_type?: string;
    target_id?: string | null;
    label?: string;
    username?: string;
    password?: string;
    notes?: string | null;
  };

  if (!target_type || !TARGET_TYPES.includes(target_type as VaultCredentialTargetType)) {
    return res.status(400).json({ error: "Geçersiz target_type" });
  }
  if (!label || !label.trim()) {
    return res.status(400).json({ error: "label zorunludur" });
  }
  if (!username || !password) {
    return res.status(400).json({ error: "username ve password zorunludur" });
  }

  const now = new Date().toISOString();

  // encrypt() HER ÇAĞRIDA taze IV üretir — düzenlemede eski şifreli değer
  // tamamen atılıp yeniden şifreleniyor, IV asla yeniden kullanılmıyor.
  db.prepare(
    `UPDATE vault_credentials
     SET target_type = ?, target_id = ?, label = ?, username_encrypted = ?, password_encrypted = ?, notes_encrypted = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    target_type,
    target_id ?? null,
    label.trim(),
    encrypt(key, username),
    encrypt(key, password),
    notes ? encrypt(key, notes) : null,
    now,
    req.params.id
  );

  logChange("vault_credentials", "update", `"${label.trim()}" güncellendi`, req.params.id);

  const row = db.prepare(`SELECT * FROM vault_credentials WHERE id = ?`).get(req.params.id) as unknown as VaultCredential;
  res.json(toPublicShape(row));
});

router.delete("/credentials/:id", (req, res) => {
  if (!getUnlockedKeyOr423(req, res)) return;

  const existing = db.prepare(`SELECT * FROM vault_credentials WHERE id = ?`).get(req.params.id) as
    | VaultCredential
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM vault_credentials WHERE id = ?`).run(req.params.id);
  logChange("vault_credentials", "delete", `"${existing.label}" silindi`, req.params.id);

  res.status(204).send();
});

// REVEAL — TEK bir kaydın username/password/notes'unu O AN çözüp döner.
// Bellekte/DB'de saklanmaz, sadece bu yanıtta bir kereliğine döner. changelog
// SADECE "görüntülendi" olayını kaydeder — çözülmüş değer ASLA logChange'e
// verilmiyor.
router.post("/credentials/:id/reveal", (req, res) => {
  const key = getUnlockedKeyOr423(req, res);
  if (!key) return;

  const row = db.prepare(`SELECT * FROM vault_credentials WHERE id = ?`).get(req.params.id) as
    | VaultCredential
    | undefined;
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });

  try {
    const username = decrypt(key, row.username_encrypted);
    const password = decrypt(key, row.password_encrypted);
    const notes = row.notes_encrypted ? decrypt(key, row.notes_encrypted) : null;

    logChange("vault_credentials", "note", `"${row.label}" için kimlik bilgisi görüntülendi`, row.id);

    res.json({ id: row.id, label: row.label, username, password, notes });
  } catch (err) {
    if (err instanceof DecryptionError) {
      return res.status(500).json({ error: "Kayıt çözülemedi — veri bozulmuş olabilir" });
    }
    throw err;
  }
});

export default router;

/** Kayıt CRUD route'ları tarafından kullanılıyor — kasa açık değilse null. */
export function requireUnlockedVaultKey(req: import("express").Request): Buffer | null {
  return getVaultKey(getAppSessionId(req));
}
