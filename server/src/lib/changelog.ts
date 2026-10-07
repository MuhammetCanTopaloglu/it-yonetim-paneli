import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";

export type ChangeAction = "create" | "update" | "delete" | "note";

export function logChange(
  tableName: string,
  action: ChangeAction,
  description: string,
  recordId?: string
): void {
  db.prepare(
    `INSERT INTO changelog (id, table_name, record_id, action, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), tableName, recordId ?? null, action, description, new Date().toISOString());
}
