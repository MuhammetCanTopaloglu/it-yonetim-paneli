/**
 * Ağ keşfi için IP aralığı parse eder. İki biçim destekleniyor:
 *  - CIDR: "192.168.1.0/24"
 *  - Tire aralığı: "192.168.1.1-192.168.1.50"
 * Sonuç dizi büyüklüğü MAX_SCAN_IPS ile sınırlıdır (ör. /16 gibi 65k IP'lik
 * bir aralık taramaya izin verilmez) — hem sunucuyu hem hedef ağı boğmamak,
 * hem de taramanın makul sürede bitmesi için.
 */
export const MAX_SCAN_IPS = 256;

export class IpRangeError extends Error {}

function ipToInt(ip: string): number {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) throw new IpRangeError(`Geçersiz IP: "${ip}"`);
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) throw new IpRangeError(`Geçersiz IP: "${ip}"`);
    const v = Number(p);
    if (v < 0 || v > 255) throw new IpRangeError(`Geçersiz IP: "${ip}"`);
    n = n * 256 + v;
  }
  return n >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function buildRange(startInt: number, endInt: number): string[] {
  if (endInt < startInt) {
    throw new IpRangeError("Aralığın bitişi başlangıcından küçük olamaz");
  }
  const count = endInt - startInt + 1;
  if (count > MAX_SCAN_IPS) {
    throw new IpRangeError(
      `Aralık çok büyük (${count} IP) — en fazla ${MAX_SCAN_IPS} IP taranabilir (ör. /24 veya daha dar bir aralık kullanın)`
    );
  }
  const ips: string[] = [];
  for (let i = startInt; i <= endInt; i++) {
    ips.push(intToIp(i));
  }
  return ips;
}

/** "192.168.1.0/24" → o ağdaki tüm IP'ler (network + broadcast dahil, basit tutmak için). */
function parseCidr(input: string): string[] {
  const [base, prefixStr] = input.split("/");
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 16 || prefix > 32) {
    throw new IpRangeError("CIDR öneki 16-32 arasında olmalıdır (ör. /24)");
  }
  const baseInt = ipToInt(base);
  const hostBits = 32 - prefix;
  const mask = hostBits === 32 ? 0 : (0xffffffff << hostBits) >>> 0;
  const network = (baseInt & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return buildRange(network, broadcast);
}

/** "192.168.1.1-192.168.1.50" → aradaki tüm IP'ler. */
function parseDashRange(input: string): string[] {
  const [startStr, endStr] = input.split("-").map((s) => s.trim());
  if (!startStr || !endStr) {
    throw new IpRangeError('Tire aralığı "başlangıç-bitiş" biçiminde olmalıdır');
  }
  return buildRange(ipToInt(startStr), ipToInt(endStr));
}

export function parseIpRange(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) throw new IpRangeError("IP aralığı zorunludur");

  if (trimmed.includes("/")) return parseCidr(trimmed);
  if (trimmed.includes("-")) return parseDashRange(trimmed);

  // Tek bir IP girilmişse (aralık değil), o tek IP'yi tara.
  return [intToIp(ipToInt(trimmed))];
}
