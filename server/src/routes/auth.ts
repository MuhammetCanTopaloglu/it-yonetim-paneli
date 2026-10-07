import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { createSession, deleteSession, getSessionUser, SESSION_TTL_DAYS } from "../lib/session.js";
import { lockVaultSession } from "../lib/vaultSession.js";
import type { User } from "../types.js";

const router = Router();

export const SESSION_COOKIE_NAME = "it_panel_session";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const MIN_PASSWORD_LENGTH = 8;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Localde HTTP üzerinden çalışıyoruz; kurumsal deploy HTTPS arkasına
    // alınınca COOKIE_SECURE=true ortam değişkeniyle açılır.
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/"
  };
}

function countUsers(): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number }).c;
}

/**
 * users tablosu boşsa, frontend Login yerine "İlk Admin Hesabı Oluştur"
 * ekranını gösterir (bkz. App.tsx / FirstAdminSetup.tsx). Paketlenmiş
 * Electron modunda konsol görünmediği için ilk admin artık migrate.ts'te
 * otomatik/rastgele oluşturulmuyor — kullanıcı adı/şifreyi burada kendisi
 * belirler.
 */
router.get("/first-run-status", (_req, res) => {
  res.json({ needsSetup: countUsers() === 0 });
});

/**
 * SADECE users tablosu boşken çalışır (409 aksi halde) — bu yüzden
 * requireAuth'tan önce mount edilmesi güvenlidir, rastgele biri sistemde
 * zaten bir admin varken buradan ikinci bir hesap açamaz.
 */
router.post("/setup-first-admin", (req, res) => {
  if (countUsers() > 0) {
    return res.status(409).json({ error: "Kurulum zaten tamamlanmış" });
  }

  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  const trimmedUsername = username?.trim();

  if (!trimmedUsername || trimmedUsername.length < 3) {
    return res.status(400).json({ error: "Kullanıcı adı en az 3 karakter olmalı" });
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı` });
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?)`
  ).run(id, trimmedUsername, hashPassword(password), now, now);

  const session = createSession(id);
  res.cookie(SESSION_COOKIE_NAME, session.id, cookieOptions());
  res.status(201).json({ id, username: trimmedUsername, role: "admin" });
});

router.post("/login", (req, res) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };

  if (!username || !password) {
    return res.status(400).json({ error: "Kullanıcı adı ve şifre gerekli" });
  }

  const genericError = () => res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı" });

  const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as User | undefined;
  if (!user) return genericError();

  const now = new Date();

  if (user.locked_until) {
    const lockedUntilMs = new Date(user.locked_until).getTime();
    if (lockedUntilMs > now.getTime()) {
      const remainingMin = Math.ceil((lockedUntilMs - now.getTime()) / 60000);
      return res
        .status(429)
        .json({ error: `Çok fazla başarısız deneme. ${remainingMin} dakika sonra tekrar deneyin.` });
    }
  }

  const ok = verifyPassword(password, user.password_hash);
  const nowIso = now.toISOString();

  if (!ok) {
    const attempts = user.failed_attempts + 1;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString();
      db.prepare(`UPDATE users SET failed_attempts = 0, locked_until = ?, updated_at = ? WHERE id = ?`).run(
        lockedUntil,
        nowIso,
        user.id
      );
      return res
        .status(429)
        .json({ error: `Çok fazla başarısız deneme. ${LOCK_MINUTES} dakika sonra tekrar deneyin.` });
    }

    db.prepare(`UPDATE users SET failed_attempts = ?, updated_at = ? WHERE id = ?`).run(attempts, nowIso, user.id);
    return genericError();
  }

  db.prepare(`UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?`).run(
    nowIso,
    user.id
  );

  const session = createSession(user.id);
  res.cookie(SESSION_COOKIE_NAME, session.id, cookieOptions());
  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post("/logout", (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (sessionId) {
    deleteSession(sessionId);
    // App oturumu kapanınca kasa da kilitlenir — anahtar zaten sadece bu
    // session id'sine bağlı bellekte tutuluyordu, burada açıkça temizleniyor.
    lockVaultSession(sessionId);
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  res.status(204).send();
});

router.get("/me", (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!sessionId) return res.status(401).json({ error: "Oturum yok" });

  const user = getSessionUser(sessionId);
  if (!user) return res.status(401).json({ error: "Oturum geçersiz veya süresi dolmuş" });

  res.json(user);
});

/**
 * Tüm /api/* route'larından önce mount edilir (index.ts). Geçerli bir
 * session cookie'si yoksa/süresi dolmuşsa 401 döner ve zinciri durdurur.
 * /api/auth/login, /api/auth/logout, /api/auth/me ve /api/health bu
 * middleware'den ÖNCE mount edildiği için etkilenmez (bkz. index.ts).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!sessionId) {
    res.status(401).json({ error: "Giriş gerekli" });
    return;
  }

  const user = getSessionUser(sessionId);
  if (!user) {
    res.status(401).json({ error: "Oturum geçersiz veya süresi dolmuş" });
    return;
  }

  req.user = user;
  next();
}

/** requireAuth'tan SONRA kullanılmalı (req.user'ın set edilmiş olması gerekir). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Bu işlem için admin yetkisi gerekli" });
    return;
  }
  next();
}

// requireAuth'tan SONRA mount edilir (index.ts) — req.user burada zaten set.
// Giriş yapmış herhangi bir kullanıcı (admin veya normal) kendi şifresini
// değiştirebilir; bu, seed admin'in ilk girişte varsayılan şifreyi
// değiştirmesi için de kullanılır.
router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = (req.body ?? {}) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Mevcut şifre ve yeni şifre gerekli" });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı` });
  }

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as User | undefined;
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  if (!verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: "Mevcut şifre yanlış" });
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(
    hashPassword(newPassword),
    now,
    user.id
  );

  res.status(204).send();
});

export default router;
