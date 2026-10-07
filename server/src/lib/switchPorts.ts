import { randomUUID } from "node:crypto";
import { db } from "../db/connection.js";
import { logChange } from "./changelog.js";
import type { SwitchPort, SwitchPortConnectionType, SwitchPortStatus } from "../types.js";

const OCCUPIED_STATUSES = new Set(["dolu", "uplink"]);

/**
 * Bakır portlar 1..copperCount, SFP portlar (copperCount+1)..(copperCount+sfpCount)
 * numaralarını kullanır. Bir port tipinin sayısı azalınca, o tipin ELİNDE KALACAK
 * son N portun üzerinde kalan (fazlalık) portlar arasından dolu/uplink olanları
 * bulur — bunlar için onay gerekir. Port_type'a göre ayrı ayrı değerlendirilir,
 * her port kendi tipi içindeki SIRA NUMARASINA göre (mevcut port_number sırasına
 * göre) tutulur/silinir; sonda hepsi 1..copperCount, copperCount+1..+sfpCount
 * olacak şekilde yeniden numaralanır.
 */
function findOccupiedPortsToRemove(
  switchId: string,
  portType: "copper" | "sfp",
  newTypeCount: number
): SwitchPort[] {
  const rows = db
    .prepare(`SELECT * FROM switch_ports WHERE switch_id = ? AND port_type = ? ORDER BY port_number ASC`)
    .all(switchId, portType) as unknown as SwitchPort[];
  const toRemove = rows.slice(newTypeCount);
  return toRemove.filter((p) => OCCUPIED_STATUSES.has(p.status));
}

export function findOccupiedPortsAbove(
  switchId: string,
  newCopperCount: number,
  newSfpCount: number
): SwitchPort[] {
  return [
    ...findOccupiedPortsToRemove(switchId, "copper", newCopperCount),
    ...findOccupiedPortsToRemove(switchId, "sfp", newSfpCount)
  ];
}

export type ReconcileResult = { ok: true } | { ok: false; occupiedPorts: SwitchPort[] };

/**
 * switches.port_count (bakır) ve/veya sfp_count değişince (veya switch ilk
 * oluşturulunca) switch_ports tablosunu bu sayılarla uyumlu hale getirir:
 *  - Bakır portlar 1..copperCount, SFP portlar copperCount+1..copperCount+sfpCount
 *    numaralarını alır.
 *  - Eksik portlar 'bos' olarak oluşturulur (ilgili port_type ile).
 *  - Fazlalık BOŞ portlar sessizce silinir.
 *  - Fazlalık DOLU/UPLINK portlar, confirmRemoval=true verilmeden silinmez
 *    (çağıran taraf önce findOccupiedPortsAbove ile kullanıcıya onay sormalı).
 *  - UNIQUE(switch_id, port_number) çakışmasını önlemek için önce kalan portlar
 *    geçici (negatif) numaralara kaydırılır, sonra final numaralarına taşınır.
 */
export function reconcilePorts(
  switchId: string,
  newCopperCount: number | null,
  newSfpCount: number | null,
  confirmRemoval: boolean
): ReconcileResult {
  const copperCount = newCopperCount ?? 0;
  const sfpCount = newSfpCount ?? 0;

  const occupied = findOccupiedPortsAbove(switchId, copperCount, sfpCount);
  if (occupied.length > 0 && !confirmRemoval) {
    return { ok: false, occupiedPorts: occupied };
  }

  const now = new Date().toISOString();

  const copperRows = db
    .prepare(`SELECT * FROM switch_ports WHERE switch_id = ? AND port_type = 'copper' ORDER BY port_number ASC`)
    .all(switchId) as unknown as SwitchPort[];
  const sfpRows = db
    .prepare(`SELECT * FROM switch_ports WHERE switch_id = ? AND port_type = 'sfp' ORDER BY port_number ASC`)
    .all(switchId) as unknown as SwitchPort[];

  const copperKeep = copperRows.slice(0, copperCount);
  const copperRemove = copperRows.slice(copperCount);
  const sfpKeep = sfpRows.slice(0, sfpCount);
  const sfpRemove = sfpRows.slice(sfpCount);

  const deleteStmt = db.prepare(`DELETE FROM switch_ports WHERE id = ?`);
  for (const p of [...copperRemove, ...sfpRemove]) {
    deleteStmt.run(p.id);
  }

  // İki aşamalı numaralandırma: önce güvenli (negatif) geçici numaralara
  // kaydır, sonra final numaralarına taşı — UNIQUE(switch_id, port_number)
  // çakışmasını önlemek için.
  const offsetStmt = db.prepare(`UPDATE switch_ports SET port_number = ? WHERE id = ?`);
  const keepOrdered = [...copperKeep, ...sfpKeep];
  keepOrdered.forEach((p, idx) => {
    offsetStmt.run(-(idx + 1), p.id);
  });

  const finalStmt = db.prepare(`UPDATE switch_ports SET port_number = ?, updated_at = ? WHERE id = ?`);
  copperKeep.forEach((p, idx) => {
    finalStmt.run(idx + 1, now, p.id);
  });
  sfpKeep.forEach((p, idx) => {
    finalStmt.run(copperCount + idx + 1, now, p.id);
  });

  const insert = db.prepare(
    `INSERT INTO switch_ports (id, switch_id, port_number, port_type, label, status, connection_type, connected_inventory_id, connected_switch_id, connected_port_number, connected_label, vlan, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, 'bos', NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`
  );

  for (let n = copperKeep.length + 1; n <= copperCount; n++) {
    insert.run(randomUUID(), switchId, n, "copper", now, now);
  }
  for (let n = sfpKeep.length + 1; n <= sfpCount; n++) {
    insert.run(randomUUID(), switchId, copperCount + n, "sfp", now, now);
  }

  return { ok: true };
}

/**
 * Bir port kaydedilirken aynı cihazın/karşı-switch-portunun başka bir portta
 * zaten kullanılıp kullanılmadığını kontrol eder. Engellemez, sadece bilgi döner.
 */
export function findConnectionConflict(
  excludePortId: string,
  connectionType: "inventory" | "switch" | "other" | null,
  connectedInventoryId: string | null,
  connectedSwitchId: string | null,
  connectedPortNumber: number | null
): string | null {
  if (connectionType === "inventory" && connectedInventoryId) {
    const row = db
      .prepare(
        `SELECT sp.port_number, s.name AS switch_name FROM switch_ports sp
         JOIN switches s ON s.id = sp.switch_id
         WHERE sp.connection_type = 'inventory' AND sp.connected_inventory_id = ? AND sp.id != ?
         LIMIT 1`
      )
      .get(connectedInventoryId, excludePortId) as { port_number: number; switch_name: string } | undefined;

    if (row) {
      return `Bu cihaz zaten "${row.switch_name}" üzerinde port ${row.port_number}'e bağlı.`;
    }
  }

  if (connectionType === "switch" && connectedSwitchId && connectedPortNumber !== null) {
    const row = db
      .prepare(
        `SELECT sp.port_number, s.name AS switch_name FROM switch_ports sp
         JOIN switches s ON s.id = sp.switch_id
         WHERE sp.connection_type = 'switch' AND sp.connected_switch_id = ? AND sp.connected_port_number = ? AND sp.id != ?
         LIMIT 1`
      )
      .get(connectedSwitchId, connectedPortNumber, excludePortId) as
      | { port_number: number; switch_name: string }
      | undefined;

    if (row) {
      return `Karşı port (hedef switch'in port ${connectedPortNumber}'i) zaten "${row.switch_name}" üzerinde port ${row.port_number} tarafından kullanılıyor olarak işaretli.`;
    }
  }

  return null;
}

function findPortByNumber(switchId: string, portNumber: number): SwitchPort | undefined {
  return db
    .prepare(`SELECT * FROM switch_ports WHERE switch_id = ? AND port_number = ?`)
    .get(switchId, portNumber) as SwitchPort | undefined;
}

function pointsBackTo(peer: SwitchPort, switchId: string, portNumber: number): boolean {
  return (
    peer.connection_type === "switch" &&
    peer.connected_switch_id === switchId &&
    peer.connected_port_number === portNumber
  );
}

function clearPortConnection(portId: string, now: string): void {
  db.prepare(
    `UPDATE switch_ports SET status = 'bos', connection_type = NULL, connected_inventory_id = NULL, connected_switch_id = NULL, connected_port_number = NULL, connected_label = NULL, updated_at = ?
     WHERE id = ?`
  ).run(now, portId);
}

export interface SwitchPortUpdateInput {
  label: string | null;
  status: SwitchPortStatus;
  connection_type: SwitchPortConnectionType | null;
  connected_inventory_id: string | null;
  connected_switch_id: string | null;
  connected_port_number: number | null;
  connected_label: string | null;
  vlan: string | null;
  notes: string | null;
}

export type PortSyncResult =
  | { ok: true; port: SwitchPort; warning: string | null }
  | { ok: false; error: string };

/**
 * Bir portu günceller ve eğer bağlantı tipi 'switch' ise VE karşı port numarası
 * belirtilmişse karşı tarafın portunu da OTOMATİK günceller (çift taraflı senkron).
 * Karşı port numarası verilmezse (sadece switch seçilip port boş bırakılırsa)
 * karşı tarafa dokunulmaz — sadece bu port kaydedilir.
 *
 * Kenar durumları:
 *  - Karşı port başka bir bağlantıyla doluysa (ve bize geri işaret etmiyorsa):
 *    işlem reddedilir, hiçbir şey değişmez (transaction rollback).
 *  - Bu portun önceki bir eşi vardı ve artık yoksa/değiştiyse: eski eş 'bos'a
 *    çekilir (tek taraflı hayalet bağlantı kalmaz) — ama SADECE eski eş hâlâ
 *    bize işaret ediyorsa (başkası onu bu sırada değiştirmediyse).
 *  - Yeni eş varsa: onun durumu bizim durumumuzla (dolu/uplink) eşitlenir,
 *    connection_type='switch', karşı switch/port bize işaret edecek şekilde
 *    ayarlanır. Eşin kendi label/vlan/notes alanlarına dokunulmaz.
 *  - Tüm güncellemeler tek transaction içinde yapılır; changelog'a hem kendi
 *    hem (varsa) eş port güncellemesi ayrı ayrı loglanır.
 */
export function updateSwitchPortWithPeerSync(
  portId: string,
  input: SwitchPortUpdateInput
): PortSyncResult {
  const existing = db.prepare(`SELECT * FROM switch_ports WHERE id = ?`).get(portId) as
    | SwitchPort
    | undefined;
  if (!existing) {
    return { ok: false, error: "Kayıt bulunamadı" };
  }

  const isOccupied = input.status === "dolu" || input.status === "uplink";
  const connectionType = isOccupied ? input.connection_type ?? null : null;
  const connectedInventoryId =
    isOccupied && connectionType === "inventory" ? input.connected_inventory_id ?? null : null;
  const connectedSwitchId = isOccupied && connectionType === "switch" ? input.connected_switch_id ?? null : null;
  const connectedPortNumber =
    isOccupied && connectionType === "switch" ? input.connected_port_number ?? null : null;
  const connectedLabel = isOccupied && connectionType === "other" ? input.connected_label ?? null : null;

  const oldPeer =
    existing.connection_type === "switch" &&
    existing.connected_switch_id &&
    existing.connected_port_number !== null
      ? findPortByNumber(existing.connected_switch_id, existing.connected_port_number)
      : undefined;

  const newPeer =
    connectionType === "switch" && connectedSwitchId && connectedPortNumber !== null
      ? findPortByNumber(connectedSwitchId, connectedPortNumber)
      : undefined;

  if (
    connectionType === "switch" &&
    connectedSwitchId &&
    connectedPortNumber !== null &&
    !newPeer
  ) {
    return { ok: false, error: "Karşı port bulunamadı (geçersiz switch/port numarası)." };
  }

  if (
    newPeer &&
    OCCUPIED_STATUSES.has(newPeer.status) &&
    !pointsBackTo(newPeer, existing.switch_id, existing.port_number) &&
    newPeer.id !== existing.id
  ) {
    const targetSwitch = db.prepare(`SELECT name FROM switches WHERE id = ?`).get(newPeer.switch_id) as
      | { name: string }
      | undefined;
    const occupant =
      newPeer.connection_type === "inventory"
        ? "başka bir cihaza"
        : newPeer.connection_type === "switch"
          ? "başka bir switch portuna"
          : newPeer.connected_label
            ? `"${newPeer.connected_label}"a`
            : "başka bir bağlantıya";
    return {
      ok: false,
      error: `"${targetSwitch?.name ?? "?"}" switch'inin port ${newPeer.port_number}'i zaten ${occupant} bağlı, önce onu boşaltın.`
    };
  }

  const warning = isOccupied
    ? findConnectionConflict(existing.id, connectionType, connectedInventoryId, connectedSwitchId, connectedPortNumber)
    : null;

  const now = new Date().toISOString();
  const ownSwitchRow = db.prepare(`SELECT name FROM switches WHERE id = ?`).get(existing.switch_id) as
    | { name: string }
    | undefined;

  db.exec("BEGIN TRANSACTION");
  try {
    db.prepare(
      `UPDATE switch_ports SET label = ?, status = ?, connection_type = ?, connected_inventory_id = ?, connected_switch_id = ?, connected_port_number = ?, connected_label = ?, vlan = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.label ?? null,
      input.status,
      connectionType,
      connectedInventoryId,
      connectedSwitchId,
      connectedPortNumber,
      connectedLabel,
      input.vlan ?? null,
      input.notes ?? null,
      now,
      portId
    );
    logChange(
      "switches",
      "update",
      `"${ownSwitchRow?.name ?? "?"}" switch'inin Port ${existing.port_number} kaydı güncellendi`,
      existing.switch_id
    );

    // Eski eş artık geçerli eş değilse (kaldırıldı veya değişti) ve hâlâ bize
    // işaret ediyorsa, hayalet bağlantı kalmasın diye boşalt.
    if (oldPeer && oldPeer.id !== newPeer?.id && pointsBackTo(oldPeer, existing.switch_id, existing.port_number)) {
      clearPortConnection(oldPeer.id, now);
      const oldPeerSwitchRow = db.prepare(`SELECT name FROM switches WHERE id = ?`).get(oldPeer.switch_id) as
        | { name: string }
        | undefined;
      logChange(
        "switches",
        "update",
        `"${oldPeerSwitchRow?.name ?? "?"}" switch'inin Port ${oldPeer.port_number} kaydı, karşı uçtaki bağlantı kaldırıldığı için otomatik boşaltıldı`,
        oldPeer.switch_id
      );
    }

    if (newPeer) {
      db.prepare(
        `UPDATE switch_ports SET status = ?, connection_type = 'switch', connected_inventory_id = NULL, connected_switch_id = ?, connected_port_number = ?, connected_label = NULL, updated_at = ?
         WHERE id = ?`
      ).run(input.status, existing.switch_id, existing.port_number, now, newPeer.id);
      const newPeerSwitchRow = db.prepare(`SELECT name FROM switches WHERE id = ?`).get(newPeer.switch_id) as
        | { name: string }
        | undefined;
      logChange(
        "switches",
        "update",
        `"${newPeerSwitchRow?.name ?? "?"}" switch'inin Port ${newPeer.port_number} kaydı, "${ownSwitchRow?.name ?? "?"}" port ${existing.port_number} ile karşılıklı bağlandığı için otomatik güncellendi`,
        newPeer.switch_id
      );
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const row = db.prepare(`SELECT * FROM switch_ports WHERE id = ?`).get(portId) as unknown as SwitchPort;
  return { ok: true, port: row, warning };
}
