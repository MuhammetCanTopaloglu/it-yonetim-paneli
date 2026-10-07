import { db } from "../db/connection.js";

/**
 * license_assignments.target_id switches/inventory'ye POLİMORFİK olarak
 * bağlanıyor (bkz. vaultLink.ts'teki aynı desen) — SQLite tek-tablo FK
 * tanımlayamadığı için switch/envanter silinirken burası elle çağrılır.
 * Atama kaydı SİLİNMEZ (koltuk sayımı/geçmişi bozulmasın), sadece
 * bağlantısı koparılır (target_id = NULL).
 */
export function unlinkLicenseAssignmentsTarget(targetType: "switch" | "inventory", targetId: string): void {
  db.prepare(`UPDATE license_assignments SET target_id = NULL WHERE target_type = ? AND target_id = ?`).run(
    targetType,
    targetId
  );
}
