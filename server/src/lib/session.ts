import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";

// 7 gün: 2-3 kişilik kapalı bir ekip için haftalık girişleri tekrar login
// istemeyecek kadar uzun, ama sınırsız/aylarca geçerli kalmayacak kadar kısa.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_DAYS = 7;

export interface SessionUser {
  id: string;
  username: string;
  role: "admin" | "user";
}

export function createSession(userId: string): { id: string; expiresAt: string } {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  db.prepare(`INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).run(
    id,
    userId,
    now.toISOString(),
    expiresAt
  );

  return { id, expiresAt };
}

export function getSessionUser(sessionId: string): SessionUser | null {
  const row = db
    .prepare(
      `SELECT u.id AS id, u.username AS username, u.role AS role, s.expires_at AS expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId) as (SessionUser & { expires_at: string }) | undefined;

  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    return null;
  }

  return { id: row.id, username: row.username, role: row.role };
}

export function deleteSession(sessionId: string): void {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}
