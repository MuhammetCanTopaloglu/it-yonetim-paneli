import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import { findFreeSample, ipToInt, intToIp, parseCidr } from "../lib/cidr.js";
import type { Subnet } from "../types.js";

const router = Router();

router.get("/", (req, res) => {
  const { q } = req.query as { q?: string };

  let sql = `SELECT * FROM subnets`;
  const params: (string | number)[] = [];

  if (q) {
    sql += ` WHERE (name LIKE ? OR cidr LIKE ? OR description LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ` ORDER BY name COLLATE NOCASE ASC`;

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM subnets WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json(row);
});

router.get("/:id/pool", (req, res) => {
  const subnet = db.prepare(`SELECT * FROM subnets WHERE id = ?`).get(req.params.id) as
    | Subnet
    | undefined;
  if (!subnet) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const info = parseCidr(subnet.cidr);
  if (!info) {
    return res.json({ valid: false, cidr: subnet.cidr });
  }

  const assignments = db
    .prepare(`SELECT ip_address FROM ip_assignments WHERE subnet_id = ?`)
    .all(req.params.id) as { ip_address: string }[];

  const usedSet = new Set<number>();
  for (const a of assignments) {
    const n = ipToInt(a.ip_address);
    if (n !== null) usedSet.add(n);
  }

  let used = 0;
  for (const n of usedSet) {
    if (n >= info.firstUsable && n <= info.lastUsable) used += 1;
  }

  const free = Math.max(info.usableCount - used, 0);
  const percentUsed = info.usableCount > 0 ? Math.round((used / info.usableCount) * 1000) / 10 : 0;

  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const { sample, truncated } = findFreeSample(info, usedSet, limit);

  res.json({
    valid: true,
    cidr: subnet.cidr,
    prefix: info.prefix,
    networkAddress: intToIp(info.network),
    broadcastAddress: intToIp(info.broadcast),
    totalUsable: info.usableCount,
    used,
    free,
    percentUsed,
    isLarge: info.prefix < 24,
    freeSample: sample,
    nextFree: sample[0] ?? null,
    sampleTruncated: truncated
  });
});

router.post("/", (req, res) => {
  const b = req.body as Partial<Subnet>;

  if (!b.name || !b.cidr) {
    return res.status(400).json({ error: "name ve cidr zorunludur" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO subnets (id, name, cidr, vlan_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, b.name, b.cidr, b.vlan_id ?? null, b.description ?? null, now);

  logChange("subnets", "create", `"${b.name}" (${b.cidr}) subnet eklendi`, id);

  const row = db.prepare(`SELECT * FROM subnets WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM subnets WHERE id = ?`).get(req.params.id) as
    | Subnet
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const b = req.body as Partial<Subnet>;

  if (!b.name || !b.cidr) {
    return res.status(400).json({ error: "name ve cidr zorunludur" });
  }

  db.prepare(
    `UPDATE subnets SET name = ?, cidr = ?, vlan_id = ?, description = ? WHERE id = ?`
  ).run(b.name, b.cidr, b.vlan_id ?? null, b.description ?? null, req.params.id);

  logChange("subnets", "update", `"${b.name}" (${b.cidr}) güncellendi`, req.params.id);

  const row = db.prepare(`SELECT * FROM subnets WHERE id = ?`).get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM subnets WHERE id = ?`).get(req.params.id) as
    | Subnet
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM subnets WHERE id = ?`).run(req.params.id);
  logChange("subnets", "delete", `"${existing.name}" (${existing.cidr}) silindi`, req.params.id);

  res.status(204).send();
});

export default router;
