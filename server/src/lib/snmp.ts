import snmp from "net-snmp";

/**
 * Standart MIB-II OID'leri — v2c, salt-okunur GET/table. Şimdilik sadece
 * "bilinen IP'ye sorgu" (keşif/LLDP kapsam dışı, ileride ayrı bir iş).
 */
const OID_SYS_NAME = "1.3.6.1.2.1.1.5.0";
const OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0";
const OID_SYS_UPTIME = "1.3.6.1.2.1.1.3.0";
const OID_IF_NUMBER = "1.3.6.1.2.1.2.1.0";
const OID_IF_TABLE = "1.3.6.1.2.1.2.2.1";
const IF_TABLE_COL_DESCR = "2";
const IF_TABLE_COL_OPER_STATUS = "8";

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_RETRIES = 1;

const OPER_STATUS_LABELS: Record<number, string> = {
  1: "up",
  2: "down",
  3: "testing",
  4: "unknown",
  5: "dormant",
  6: "notPresent",
  7: "lowerLayerDown"
};

export interface SnmpInterfaceStatus {
  index: number;
  name: string;
  operStatus: string;
}

export interface SnmpQueryResult {
  sysName: string;
  sysDescr: string;
  sysUpTime: { ticks: number; formatted: string };
  ifNumber: number;
  interfaces: SnmpInterfaceStatus[];
}

export interface SnmpBasicInfo {
  sysName: string;
  sysDescr: string;
  ifNumber: number;
}

export class SnmpQueryError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "snmp_error"
  ) {
    super(message);
  }
}

/** SNMP TimeTicks (1/100 saniye) → "3 gün 4 saat 12 dakika" gibi okunur metin. */
function formatUptime(ticks: number): string {
  const totalSeconds = Math.floor(ticks / 100);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0) parts.push(`${hours} saat`);
  if (parts.length < 2 && minutes > 0) parts.push(`${minutes} dakika`);
  return parts.length > 0 ? parts.join(" ") : "1 dakikadan az";
}

/**
 * Ağ keşfi için HAFİF sorgu — sadece sysName/sysDescr/ifNumber (ifTable walk
 * YOK). Bir /24 taramasında 254 IP'nin çoğu boş dönecek/timeout olacağı için
 * her IP'ye tek bir GET yeterli, port tablosu walk'ı gereksiz yavaşlık katar.
 * `querySnmpDevice` ile aynı hata sözleşmesi (SnmpQueryError, timeout).
 */
export function querySnmpBasic(
  ip: string,
  community: string,
  port = 161,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SnmpBasicInfo> {
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(ip, community, {
      port,
      version: snmp.Version2c,
      timeout: timeoutMs,
      retries: 0
    });

    let settled = false;
    function finish(fn: () => void) {
      if (settled) return;
      settled = true;
      session.close();
      fn();
    }

    session.on("error", (err: Error) => {
      finish(() => reject(new SnmpQueryError(err.message, "timeout")));
    });

    session.get([OID_SYS_NAME, OID_SYS_DESCR, OID_IF_NUMBER], (error, varbinds) => {
      if (error || !varbinds) {
        finish(() => reject(new SnmpQueryError(error?.message ?? "Yanıt alınamadı", "timeout")));
        return;
      }
      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) {
          finish(() => reject(new SnmpQueryError(snmp.varbindError(vb), "snmp_error")));
          return;
        }
      }
      finish(() =>
        resolve({
          sysName: String(varbinds[0].value),
          sysDescr: String(varbinds[1].value),
          ifNumber: Number(varbinds[2].value)
        })
      );
    });
  });
}

/**
 * Belirtilen IP'ye SNMP v2c ile bağlanıp temel bilgi + port durumlarını
 * çeker. Cevap gelmezse (yanlış IP/community, cihaz kapalı, ağ erişimi yok)
 * `SnmpQueryError("timeout", ...)` fırlatır — çağıran taraf bunu 504'e
 * çevirir. Session her durumda (başarı/hata) kapatılır.
 */
export function querySnmpDevice(
  ip: string,
  community: string,
  port = 161,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SnmpQueryResult> {
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(ip, community, {
      port,
      version: snmp.Version2c,
      timeout: timeoutMs,
      retries: DEFAULT_RETRIES
    });

    let settled = false;
    function finish(fn: () => void) {
      if (settled) return;
      settled = true;
      session.close();
      fn();
    }

    session.on("error", (err: Error) => {
      finish(() => reject(new SnmpQueryError(err.message, "timeout")));
    });

    session.get([OID_SYS_NAME, OID_SYS_DESCR, OID_SYS_UPTIME, OID_IF_NUMBER], (error, varbinds) => {
      if (error || !varbinds) {
        finish(() => reject(new SnmpQueryError(error?.message ?? "Yanıt alınamadı", "timeout")));
        return;
      }

      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) {
          finish(() => reject(new SnmpQueryError(snmp.varbindError(vb), "snmp_error")));
          return;
        }
      }

      const sysName = String(varbinds[0].value);
      const sysDescr = String(varbinds[1].value);
      const upTimeTicks = Number(varbinds[2].value);
      const ifNumber = Number(varbinds[3].value);

      // NOT: net-snmp'nin session.table() yardımcı fonksiyonu, ardışık
      // olmayan kolonlarla (burada 2 ve 8, aradaki 3-7 hiç istenmiyor) test
      // edildiğinde boş sonuç döndürüyor (kütüphane içi bir sınırlama/hata —
      // gerçek bir SNMP ajanına karşı doğrulandı). Bunun yerine ham
      // subtree() walk'ı kullanıp OID'nin son iki bileşeninden
      // (kolon.satır) kendimiz tablo kuruyoruz — güvenilir çalışan yol bu.
      const rows = new Map<number, { descr?: string; operStatus?: number }>();

      session.subtree(
        OID_IF_TABLE,
        20,
        (varbinds) => {
          for (const vb of varbinds) {
            if (snmp.isVarbindError(vb)) continue;
            const suffix = vb.oid.slice(OID_IF_TABLE.length + 1).split(".");
            if (suffix.length !== 2) continue;
            const [column, rowIndexStr] = suffix;
            const rowIndex = Number(rowIndexStr);
            const row = rows.get(rowIndex) ?? {};
            if (column === IF_TABLE_COL_DESCR) row.descr = String(vb.value);
            if (column === IF_TABLE_COL_OPER_STATUS) row.operStatus = Number(vb.value);
            rows.set(rowIndex, row);
          }
        },
        (walkError) => {
          // Port tablosu alınamasa bile temel bilgiyi döndür — tamamen
          // başarısız saymaya gerek yok (bazı cihazlar ifTable'ı kısıtlamış olabilir).
          const interfaces: SnmpInterfaceStatus[] = walkError
            ? []
            : Array.from(rows.entries())
                .map(([index, row]) => ({
                  index,
                  name: row.descr ?? `#${index}`,
                  operStatus: OPER_STATUS_LABELS[row.operStatus ?? -1] ?? "unknown"
                }))
                .sort((a, b) => a.index - b.index);

          finish(() =>
            resolve({
              sysName,
              sysDescr,
              sysUpTime: { ticks: upTimeTicks, formatted: formatUptime(upTimeTicks) },
              ifNumber,
              interfaces
            })
          );
        }
      );
    });
  });
}
