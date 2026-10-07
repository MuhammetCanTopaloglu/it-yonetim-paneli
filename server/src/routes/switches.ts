import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "../lib/changelog.js";
import { reconcilePorts } from "../lib/switchPorts.js";
import type { Switch } from "../types.js";
import { SWITCH_PUBLIC_COLUMNS } from "../types.js";
import { computeBlastRadius } from "../lib/blastRadius.js";
import { unlinkVaultCredentialsTarget } from "../lib/vaultLink.js";
import { unlinkLicenseAssignmentsTarget } from "../lib/licenseLink.js";

const router = Router();

router.get("/", (req, res) => {
  const { q } = req.query as { q?: string };

  let sql = `SELECT ${SWITCH_PUBLIC_COLUMNS} FROM switches`;
  const params: string[] = [];

  if (q) {
    sql += ` WHERE (name LIKE ? OR model LIKE ? OR management_ip LIKE ? OR location LIKE ? OR vlans LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }

  sql += ` ORDER BY name COLLATE NOCASE ASC`;

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT ${SWITCH_PUBLIC_COLUMNS} FROM switches WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json(row);
});

router.post("/", (req, res) => {
  const b = req.body as Partial<Switch>;

  if (!b.name) {
    return res.status(400).json({ error: "name zorunludur" });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO switches (id, name, model, management_ip, port_count, sfp_count, vlans, location, notes, pos_x, pos_y, is_backbone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    b.name,
    b.model ?? null,
    b.management_ip ?? null,
    b.port_count ?? null,
    b.sfp_count ?? 0,
    b.vlans ?? null,
    b.location ?? null,
    b.notes ?? null,
    b.pos_x ?? 0,
    b.pos_y ?? 0,
    b.is_backbone ? 1 : 0,
    now,
    now
  );

  if (b.port_count || b.sfp_count) {
    reconcilePorts(id, b.port_count ?? 0, b.sfp_count ?? 0, true);
  }

  logChange("switches", "create", `"${b.name}" switch eklendi`, id);

  const row = db.prepare(`SELECT ${SWITCH_PUBLIC_COLUMNS} FROM switches WHERE id = ?`).get(id);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM switches WHERE id = ?`).get(req.params.id) as
    | Switch
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const b = req.body as Partial<Switch> & { confirm_port_removal?: boolean };

  if (!b.name) {
    return res.status(400).json({ error: "name zorunludur" });
  }

  const copperChanged = b.port_count !== undefined && b.port_count !== existing.port_count;
  const sfpChanged = b.sfp_count !== undefined && b.sfp_count !== existing.sfp_count;
  if (copperChanged || sfpChanged) {
    const newCopper = b.port_count !== undefined ? b.port_count ?? 0 : existing.port_count ?? 0;
    const newSfp = b.sfp_count !== undefined ? b.sfp_count ?? 0 : existing.sfp_count ?? 0;
    const result = reconcilePorts(req.params.id, newCopper, newSfp, b.confirm_port_removal === true);
    if (!result.ok) {
      return res.status(409).json({
        error: "Bazı portlarda kayıtlı bağlantılar var, önce onay gerekiyor",
        occupiedPorts: result.occupiedPorts
      });
    }
  }

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE switches SET name = ?, model = ?, management_ip = ?, port_count = ?, sfp_count = ?, vlans = ?, location = ?, notes = ?, is_backbone = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    b.name,
    b.model ?? null,
    b.management_ip ?? null,
    b.port_count ?? null,
    b.sfp_count ?? 0,
    b.vlans ?? null,
    b.location ?? null,
    b.notes ?? null,
    b.is_backbone ? 1 : 0,
    now,
    req.params.id
  );

  logChange("switches", "update", `"${b.name}" güncellendi`, req.params.id);

  const row = db.prepare(`SELECT ${SWITCH_PUBLIC_COLUMNS} FROM switches WHERE id = ?`).get(req.params.id);
  res.json(row);
});

router.patch("/:id/position", (req, res) => {
  const existing = db.prepare(`SELECT * FROM switches WHERE id = ?`).get(req.params.id) as
    | Switch
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const { pos_x, pos_y } = req.body as { pos_x?: number; pos_y?: number };
  if (typeof pos_x !== "number" || typeof pos_y !== "number") {
    return res.status(400).json({ error: "pos_x ve pos_y sayısal olmalıdır" });
  }

  db.prepare(`UPDATE switches SET pos_x = ?, pos_y = ?, updated_at = ? WHERE id = ?`).run(
    pos_x,
    pos_y,
    new Date().toISOString(),
    req.params.id
  );

  res.status(204).send();
});

// Etki analizi: bu switch devre dışı kalırsa omurgaya ulaşamayan switch'ler
// + o switch'lere bağlı envanter cihazları. Saf hesaplama computeBlastRadius'ta
// (birim testli) — burası sadece veriyi DB'den toplayıp veriyor, DB'ye
// hiçbir şey YAZMIYOR (anlık analiz).
router.get("/:id/blast-radius", (req, res) => {
  const targetId = req.params.id;
  const target = db.prepare(`SELECT id FROM switches WHERE id = ?`).get(targetId);
  if (!target) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const allSwitches = db.prepare(`SELECT id, name, is_backbone FROM switches`).all() as {
    id: string;
    name: string;
    is_backbone: number;
  }[];
  const switchIds = allSwitches.map((s) => s.id);
  const backboneIds = allSwitches.filter((s) => s.is_backbone).map((s) => s.id);
  const nameById = new Map(allSwitches.map((s) => [s.id, s.name]));

  const links = db.prepare(`SELECT source_id, target_id FROM switch_links`).all() as {
    source_id: string;
    target_id: string;
  }[];
  // switch_ports'taki switch-switch bağlantıları port_type'tan (bakır/SFP)
  // BAĞIMSIZ olarak dahil edilir — topolojide sadece SFP çizilse de gerçek
  // fiziksel bağlantı (bakır dahil) burada var olmaya devam ediyor.
  const portLinks = db
    .prepare(
      `SELECT switch_id, connected_switch_id FROM switch_ports WHERE connection_type = 'switch' AND connected_switch_id IS NOT NULL`
    )
    .all() as { switch_id: string; connected_switch_id: string }[];

  const edges: [string, string][] = [
    ...links.map((l): [string, string] => [l.source_id, l.target_id]),
    ...portLinks.map((p): [string, string] => [p.switch_id, p.connected_switch_id])
  ];

  const result = computeBlastRadius({ switchIds, edges, backboneIds, targetId });

  const affectedSwitches = result.affectedSwitchIds.map((id) => ({
    id,
    name: nameById.get(id) ?? id
  }));

  let affectedInventory: {
    id: string;
    name: string;
    type: string;
    status: string;
    switchId: string;
    switchName: string;
  }[] = [];

  if (result.affectedSwitchIds.length > 0) {
    const placeholders = result.affectedSwitchIds.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT sp.switch_id AS switchId, i.id AS id, i.name AS name, i.type AS type, i.status AS status
         FROM switch_ports sp
         JOIN inventory i ON i.id = sp.connected_inventory_id
         WHERE sp.connection_type = 'inventory' AND sp.switch_id IN (${placeholders})`
      )
      .all(...result.affectedSwitchIds) as {
      switchId: string;
      id: string;
      name: string;
      type: string;
      status: string;
    }[];

    affectedInventory = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      status: r.status,
      switchId: r.switchId,
      switchName: nameById.get(r.switchId) ?? r.switchId
    }));
  }

  res.json({ ...result, affectedSwitches, affectedInventory });
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM switches WHERE id = ?`).get(req.params.id) as
    | Switch
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  db.prepare(`DELETE FROM switches WHERE id = ?`).run(req.params.id);
  unlinkVaultCredentialsTarget("switch", req.params.id);
  unlinkLicenseAssignmentsTarget("switch", req.params.id);
  logChange("switches", "delete", `"${existing.name}" silindi`, req.params.id);

  res.status(204).send();
});

export default router;
