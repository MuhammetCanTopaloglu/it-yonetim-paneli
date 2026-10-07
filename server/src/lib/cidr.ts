/**
 * IPv4 CIDR yardımcıları. Sadece IPv4 destekler — IPv6 veya geçersiz girdi
 * için parseCidr null döner, çağıran taraf bunu zarifçe ele alır (kod kırılmaz).
 */

export interface CidrInfo {
  network: number; // uint32
  broadcast: number; // uint32
  prefix: number;
  firstUsable: number; // uint32
  lastUsable: number; // uint32
  usableCount: number;
  totalAddresses: number;
}

export function ipToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;

  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const v = Number(part);
    if (v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function parseCidr(cidr: string): CidrInfo | null {
  const [ipPart, prefixPart] = cidr.trim().split("/");
  if (!ipPart || prefixPart === undefined) return null;

  const prefix = Number(prefixPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;

  const ipNum = ipToInt(ipPart);
  if (ipNum === null) return null;

  const maskBits = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipNum & maskBits) >>> 0;
  const broadcast = (network | (~maskBits >>> 0)) >>> 0;
  const totalAddresses = 2 ** (32 - prefix);

  let firstUsable: number;
  let lastUsable: number;
  let usableCount: number;

  if (prefix >= 31) {
    // /31 (point-to-point) ve /32 (tek host) için ağ/broadcast ayrımı yapılmaz
    firstUsable = network;
    lastUsable = broadcast;
    usableCount = totalAddresses;
  } else {
    firstUsable = network + 1;
    lastUsable = broadcast - 1;
    usableCount = totalAddresses - 2;
  }

  return { network, broadcast, prefix, firstUsable, lastUsable, usableCount, totalAddresses };
}

// /16'dan büyük aralıklarda bile makul sürede tarama yapmak için üst sınır.
const MAX_SCAN = 65536;

export function findFreeSample(
  info: CidrInfo,
  usedSet: Set<number>,
  limit: number
): { sample: string[]; truncated: boolean } {
  const sample: string[] = [];
  let scanned = 0;

  for (let ip = info.firstUsable; ip <= info.lastUsable && scanned < MAX_SCAN; ip++, scanned++) {
    if (sample.length >= limit) break;
    if (!usedSet.has(ip)) sample.push(intToIp(ip));
  }

  return { sample, truncated: scanned >= MAX_SCAN && sample.length < limit };
}
