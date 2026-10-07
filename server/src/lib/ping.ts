import { execFile } from "node:child_process";
import os from "node:os";

/**
 * Native bir ping kütüphanesi (ör. npm "ping") yerine sistemin kendi `ping`
 * komutunu çağırıyoruz — daha önce better-sqlite3'te yaşadığımız native
 * derleme sorununu baştan bypass eder, sıfır bağımlılık. `execFile`
 * kullanılıyor (`exec` değil): argümanlar ayrı bir dizi olarak geçiliyor,
 * hiçbir shell'e gitmiyor — IP değeri (kullanıcının envanterde girdiği veri)
 * bu yüzden komut enjeksiyonu riski taşımadan doğrudan argüman olarak
 * iletilebiliyor, escape etmeye gerek yok.
 *
 * Windows ve Linux'ta `ping` komutunun bayrakları VE çıktısı farklı:
 * - Windows: `ping -n 1 -w <ms> <ip>` — bazı sistemlerde host'a ulaşılamasa
 *   bile exit code 0 dönebiliyor, bu yüzden çıktıda "TTL=" arıyoruz (gerçek
 *   bir yanıt geldiyse mutlaka bu satır olur).
 * - Linux (ve varsayılan): `ping -c 1 -W <saniye> <ip>` — exit code 0 = en az
 *   bir yanıt geldi, güvenilir bir gösterge (Linux'ta -W saniye cinsinden;
 *   macOS'un BSD ping'inde -W milisaniyedir, şimdilik hedef platform
 *   olmadığı için ayrıca ele alınmadı).
 *
 * NOT (deploy): Bu özellik sunucunun ÇALIŞTIĞI makineden ping atar. Şu an
 * localde geliştiricinin kendi ağındaki cihazlara ulaşabiliyor. İleride
 * kurumsal bir sunucuya taşınırsa, o sunucunun hedef IP'lere (ofis ağına)
 * ağ erişimi olması gerekir — aksi halde tüm cihazlar "çevrimdışı" görünür.
 */
const isWindows = os.platform() === "win32";

export function pingHost(ip: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const args = isWindows
      ? ["-n", "1", "-w", String(timeoutMs), ip]
      : ["-c", "1", "-W", String(Math.max(1, Math.ceil(timeoutMs / 1000))), ip];

    execFile("ping", args, { timeout: timeoutMs + 1000 }, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(isWindows ? /ttl=/i.test(stdout) : true);
    });
  });
}

/** Sınırlı eşzamanlılıkla bir listeyi işler — hepsini paralel atıp sistemi
 * boğmak yerine, her an en fazla `limit` kadar iş aynı anda çalışır. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      await task(item);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
