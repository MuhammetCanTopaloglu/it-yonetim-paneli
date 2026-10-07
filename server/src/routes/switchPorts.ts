import { Router } from "express";
import { db } from "../db/connection.js";
import { updateSwitchPortWithPeerSync } from "../lib/switchPorts.js";
import type { SwitchPort, SwitchPortConnectionType, SwitchPortStatus } from "../types.js";

const router = Router();

const VALID_STATUSES: SwitchPortStatus[] = ["bos", "dolu", "kapali", "uplink"];
const VALID_CONNECTION_TYPES: SwitchPortConnectionType[] = ["inventory", "switch", "other"];

router.get("/", (req, res) => {
  const { switch_id } = req.query as { switch_id?: string };
  if (!switch_id) {
    return res.status(400).json({ error: "switch_id zorunludur" });
  }

  const rows = db
    .prepare(`SELECT * FROM switch_ports WHERE switch_id = ? ORDER BY port_number ASC`)
    .all(switch_id);

  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = db.prepare(`SELECT * FROM switch_ports WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Kayıt bulunamadı" });
  res.json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM switch_ports WHERE id = ?`).get(req.params.id) as
    | SwitchPort
    | undefined;
  if (!existing) return res.status(404).json({ error: "Kayıt bulunamadı" });

  const b = req.body as Partial<SwitchPort>;

  if (!b.status || !VALID_STATUSES.includes(b.status)) {
    return res.status(400).json({ error: "Geçersiz status değeri" });
  }
  if (b.connection_type && !VALID_CONNECTION_TYPES.includes(b.connection_type)) {
    return res.status(400).json({ error: "Geçersiz connection_type değeri" });
  }

  const result = updateSwitchPortWithPeerSync(req.params.id, {
    label: b.label ?? null,
    status: b.status,
    connection_type: b.connection_type ?? null,
    connected_inventory_id: b.connected_inventory_id ?? null,
    connected_switch_id: b.connected_switch_id ?? null,
    connected_port_number: b.connected_port_number ?? null,
    connected_label: b.connected_label ?? null,
    vlan: b.vlan ?? null,
    notes: b.notes ?? null
  });

  if (!result.ok) {
    return res.status(409).json({ error: result.error });
  }

  res.json({ port: result.port, warning: result.warning });
});

export default router;
