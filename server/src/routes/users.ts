import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { hashPassword } from "../lib/password.js";
import { logChange } from "../lib/changelog.js";
import { requireAdmin } from "./auth.js";
import type { User, UserRole } from "../types.js";

const router = Router();

// Bu router'ın tamamı requireAdmin ile korunur — sadece admin kullanıcı
// yönetebilir. (requireAuth zaten index.ts'de bu router'dan önce global
// olarak uygulanıyor, req.user burada garanti set edilmiş durumda.)
router.use(requireAdmin);

const MIN_PASSWORD_LENGTH = 8;
const VALID_ROLES: UserRole[] = ["admin", "user"];

function countAdmins(): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get() as { c: number };
  return row.c;
}

router.get("/", (_req, res) => {
  const rows = db
    .prepare(`SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at ASC`)
    .all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { username, password, role } = (req.body ?? {}) as {
    username?: string;
    password?: string;
    role?: UserRole;
  };

  if (!username || !password) {
    return res.status(400).json({ error: "Kullanıcı adı ve şifre gerekli" });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı` });
  }

  const finalRole: UserRole = role ?? "user";
  if (!VALID_ROLES.includes(finalRole)) {
    return res.status(400).json({ error: "Geçersiz rol" });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (existing) {
    return res.status(409).json({ error: "Bu kullanıcı adı zaten kullanılıyor" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, username, hashPassword(password), finalRole, now, now);

  logChange("users", "create", `"${username}" kullanıcısı eklendi (rol: ${finalRole})`, id);

  res.status(201).json({ id, username, role: finalRole, created_at: now, updated_at: now });
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id) as User | undefined;
  if (!existing) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  const { role, password } = (req.body ?? {}) as { role?: UserRole; password?: string };
  const now = new Date().toISOString();
  const changeDescriptions: string[] = [];

  if (role !== undefined && role !== existing.role) {
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Geçersiz rol" });
    }

    if (existing.role === "admin" && role === "user") {
      if (req.params.id === req.user!.id) {
        return res.status(400).json({ error: "Kendi admin rolünüzü düşüremezsiniz" });
      }
      if (countAdmins() <= 1) {
        return res.status(400).json({ error: "Sistemde en az bir admin olmalı" });
      }
    }

    db.prepare(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`).run(role, now, req.params.id);
    changeDescriptions.push(`rol: ${existing.role} → ${role}`);
  }

  if (password !== undefined) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı` });
    }
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(
      hashPassword(password),
      now,
      req.params.id
    );
    changeDescriptions.push("şifre sıfırlandı");
  }

  if (changeDescriptions.length > 0) {
    logChange(
      "users",
      "update",
      `"${existing.username}" kullanıcısı güncellendi (${changeDescriptions.join(", ")})`,
      req.params.id
    );
  }

  const row = db
    .prepare(`SELECT id, username, role, created_at, updated_at FROM users WHERE id = ?`)
    .get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id) as User | undefined;
  if (!existing) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: "Kendi hesabınızı silemezsiniz" });
  }

  if (existing.role === "admin" && countAdmins() <= 1) {
    return res.status(400).json({ error: "Sistemde en az bir admin olmalı" });
  }

  // sessions.user_id -> ON DELETE CASCADE: silinen kullanıcının aktif
  // oturumları da anında geçersiz olur, erişimi hemen kesilir.
  db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id);
  logChange("users", "delete", `"${existing.username}" kullanıcısı silindi`, req.params.id);

  res.status(204).send();
});

export default router;
