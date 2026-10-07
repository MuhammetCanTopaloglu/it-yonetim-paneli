import { db } from "../db/connection.js";

/**
 * vault_credentials.target_id switches/inventory'ye POLİMORFİK olarak
 * bağlanıyor (target_type'a göre iki farklı tabloya işaret edebilir) — SQLite
 * FOREIGN KEY tek bir tabloyu hedefleyebildiği için "ON DELETE SET NULL" DB
 * seviyesinde tanımlanamıyor. Bu yüzden switch/envanter silinirken burası
 * elle çağrılır: kimlik bilgisi kaydı SİLİNMEZ (hassas veri sessizce
 * kaybolmasın), sadece bağlantısı koparılır (target_id = NULL) — kullanıcı
 * sonra etiketi elle düzenler.
 */
export function unlinkVaultCredentialsTarget(targetType: "switch" | "inventory", targetId: string): void {
  db.prepare(`UPDATE vault_credentials SET target_id = NULL WHERE target_type = ? AND target_id = ?`).run(
    targetType,
    targetId
  );
}
