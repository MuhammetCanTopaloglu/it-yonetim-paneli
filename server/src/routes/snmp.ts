import { Router } from "express";
import { db } from "../db/connection.js";
import { querySnmpDevice, querySnmpBasic, SnmpQueryError } from "../lib/snmp.js";
import { parseIpRange, IpRangeError } from "../lib/ipRange.js";
import { runWithConcurrency } from "../lib/ping.js";

const router = Router();

const DEFAULT_PORT = 161;
const DISCOVERY_TIMEOUT_MS = 800;
const DISCOVERY_CONCURRENCY = 20;

interface SnmpQueryBody {
  ip?: string;
  community?: string;
  port?: number;
  /** Verilirse ve community boşsa, switches.snmp_community'den okunur (fallback). */
  switchId?: string;
}

// Manuel tetiklemeli, anlık sorgu — ping deseniyle tutarlı: sonuç DB'ye
// yazılmaz. community string request body'de düz metin gelir (HTTPS/local
// ağ varsayımıyla) ama yanıtta ASLA geri döndürülmez.
router.post("/query", async (req, res) => {
  const { ip, community, port, switchId } = req.body as SnmpQueryBody;

  if (!ip || typeof ip !== "string") {
    return res.status(400).json({ error: "ip zorunludur" });
  }

  let resolvedCommunity = community;
  if (!resolvedCommunity && switchId) {
    const row = db.prepare(`SELECT snmp_community FROM switches WHERE id = ?`).get(switchId) as
      | { snmp_community: string | null }
      | undefined;
    resolvedCommunity = row?.snmp_community ?? undefined;
  }

  if (!resolvedCommunity) {
    return res.status(400).json({ error: "community string gerekli (bu switch için kayıtlı değil)" });
  }

  try {
    const result = await querySnmpDevice(ip, resolvedCommunity, port ?? DEFAULT_PORT);
    res.json(result);
  } catch (err) {
    if (err instanceof SnmpQueryError && err.code === "timeout") {
      return res.status(504).json({ error: "Cihazdan yanıt alınamadı (timeout) — IP, port veya community string'i kontrol edin" });
    }
    const message = err instanceof Error ? err.message : "SNMP sorgusu başarısız oldu";
    res.status(502).json({ error: message });
  }
});

interface SnmpDiscoverBody {
  ipRange?: string;
  community?: string;
  port?: number;
}

export interface DiscoveredDevice {
  ip: string;
  sysName: string;
  sysDescr: string;
  ifNumber: number;
}

// Ağ keşfi: aralıktaki her IP'ye HAFİF bir SNMP sorgusu atar (querySnmpBasic
// — port tablosu YOK, sadece sysName/sysDescr/ifNumber). DB'ye HİÇBİR ŞEY
// YAZMAZ — sadece aday listesi döner, ekleme ayrı bir adımda (mevcut
// POST /api/switches ile, frontend tarafından) yapılır. community string
// burada da yanıtta asla geri döndürülmez, loglanmaz.
router.post("/discover", async (req, res) => {
  const { ipRange, community, port } = req.body as SnmpDiscoverBody;

  if (!ipRange || typeof ipRange !== "string") {
    return res.status(400).json({ error: "ipRange zorunludur" });
  }
  if (!community || typeof community !== "string") {
    return res.status(400).json({ error: "community string zorunludur" });
  }

  let ips: string[];
  try {
    ips = parseIpRange(ipRange);
  } catch (err) {
    if (err instanceof IpRangeError) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: "Geçersiz IP aralığı" });
  }

  const found: DiscoveredDevice[] = [];

  await runWithConcurrency(ips, DISCOVERY_CONCURRENCY, async (ip) => {
    try {
      const info = await querySnmpBasic(ip, community, port ?? DEFAULT_PORT, DISCOVERY_TIMEOUT_MS);
      found.push({ ip, ...info });
    } catch {
      // Beklenen durum: taranan IP'lerin çoğu boş/cevapsız olacak — sessizce atla.
    }
  });

  found.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));

  res.json({ scanned: ips.length, found });
});

export default router;
