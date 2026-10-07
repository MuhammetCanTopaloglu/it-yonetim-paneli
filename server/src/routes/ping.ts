import { Router } from "express";
import { db } from "../db/connection.js";
import { pingHost, runWithConcurrency } from "../lib/ping.js";

const router = Router();

const PING_TIMEOUT_MS = 1500;
const PING_CONCURRENCY = 8;

interface OfflineDevice {
  id: string;
  name: string;
  ip_address: string;
}

interface PingSource {
  id: string;
  name: string;
  ip_address: string;
}

// Manuel tetiklemeli, anlık kontrol — sonuç DB'ye yazılmıyor, changelog'a
// düşülmüyor (kalıcı bir durum değil, sadece o anki ağ görünümü).
router.post("/check", async (_req, res) => {
  const inventoryRows = db
    .prepare(
      `SELECT id, name, ip_address FROM inventory WHERE ip_address IS NOT NULL AND ip_address != '' ORDER BY name COLLATE NOCASE ASC`
    )
    .all() as unknown as PingSource[];

  const switchRows = db
    .prepare(
      `SELECT id, name, management_ip AS ip_address FROM switches WHERE management_ip IS NOT NULL AND management_ip != '' ORDER BY name COLLATE NOCASE ASC`
    )
    .all() as unknown as PingSource[];

  // Aynı IP hem bir switch'te hem bir envanter kaydında olabilir (ör. aynı
  // fiziksel cihazın iki farklı kaydı) — gereksiz yere aynı IP'ye iki kez
  // ping atmamak için IP bazında TEKİLLEŞTİRİYORUZ, ama sonuç her iki kaydın
  // altında da AYRI AYRI gösteriliyor (birini kaybetmiyoruz).
  const uniqueIps = Array.from(new Set([...inventoryRows, ...switchRows].map((r) => r.ip_address)));
  const resultByIp = new Map<string, boolean>();

  await runWithConcurrency(uniqueIps, PING_CONCURRENCY, async (ip) => {
    const reachable = await pingHost(ip, PING_TIMEOUT_MS);
    resultByIp.set(ip, reachable);
  });

  const offlineInventory: OfflineDevice[] = [];
  const offlineSwitches: OfflineDevice[] = [];
  let onlineCount = 0;

  for (const item of inventoryRows) {
    if (resultByIp.get(item.ip_address)) {
      onlineCount++;
    } else {
      offlineInventory.push(item);
    }
  }
  for (const item of switchRows) {
    if (resultByIp.get(item.ip_address)) {
      onlineCount++;
    } else {
      offlineSwitches.push(item);
    }
  }

  offlineInventory.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  offlineSwitches.sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const total = inventoryRows.length + switchRows.length;
  const offline = offlineInventory.length + offlineSwitches.length;

  res.json({
    checkedAt: new Date().toISOString(),
    total,
    online: onlineCount,
    offline,
    offlineDevices: offlineInventory,
    offlineSwitches
  });
});

export default router;
