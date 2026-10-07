import { Router } from "express";
import { db } from "../db/connection.js";

const router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

router.get("/", (req, res) => {
  const { table_name, action, date_from, date_to, q, limit, offset } = req.query as {
    table_name?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
    limit?: string;
    offset?: string;
  };

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (table_name) {
    conditions.push(`table_name = ?`);
    params.push(table_name);
  }
  if (action) {
    conditions.push(`action = ?`);
    params.push(action);
  }
  if (date_from) {
    conditions.push(`created_at >= ?`);
    params.push(date_from);
  }
  if (date_to) {
    // gün sonuna kadar dahil et
    conditions.push(`created_at <= ?`);
    params.push(`${date_to}T23:59:59.999Z`);
  }
  if (q) {
    conditions.push(`description LIKE ?`);
    params.push(`%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const parsedLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const parsedOffset = Math.max(Number(offset) || 0, 0);

  const rows = db
    .prepare(`SELECT * FROM changelog ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, parsedLimit + 1, parsedOffset);

  const hasMore = rows.length > parsedLimit;
  const items = hasMore ? rows.slice(0, parsedLimit) : rows;

  res.json({ items, hasMore });
});

export default router;
