import { Router } from "express";
import { db } from "../db/connection.js";

const router = Router();

const LIMIT = 5;
const MIN_LENGTH = 2;

router.get("/", (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() ?? "";

  if (q.length < MIN_LENGTH) {
    return res.json({ switches: [], inventory: [], ip_assignments: [], notes: [], todos: [] });
  }

  const like = `%${q}%`;

  const switches = db
    .prepare(
      `SELECT id, name, model, management_ip, location FROM switches
       WHERE name LIKE ? OR model LIKE ? OR management_ip LIKE ? OR location LIKE ?
       ORDER BY name COLLATE NOCASE ASC LIMIT ?`
    )
    .all(like, like, like, like, LIMIT);

  const inventory = db
    .prepare(
      `SELECT id, name, type, serial_no, brand_model, ip_address, location FROM inventory
       WHERE name LIKE ? OR serial_no LIKE ? OR brand_model LIKE ? OR ip_address LIKE ? OR location LIKE ?
       ORDER BY name COLLATE NOCASE ASC LIMIT ?`
    )
    .all(like, like, like, like, like, LIMIT);

  const ip_assignments = db
    .prepare(
      `SELECT ip.id, ip.ip_address, ip.device_name, sn.name AS subnet_name FROM ip_assignments ip
       LEFT JOIN subnets sn ON sn.id = ip.subnet_id
       WHERE ip.ip_address LIKE ? OR ip.device_name LIKE ?
       ORDER BY ip.ip_address ASC LIMIT ?`
    )
    .all(like, like, LIMIT);

  const notes = db
    .prepare(
      `SELECT id, title, tags FROM notes
       WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
       ORDER BY updated_at DESC LIMIT ?`
    )
    .all(like, like, like, LIMIT);

  const todos = db
    .prepare(
      `SELECT id, title, status, priority FROM todos
       WHERE title LIKE ? OR description LIKE ?
       ORDER BY due_date ASC LIMIT ?`
    )
    .all(like, like, LIMIT);

  res.json({ switches, inventory, ip_assignments, notes, todos });
});

export default router;
