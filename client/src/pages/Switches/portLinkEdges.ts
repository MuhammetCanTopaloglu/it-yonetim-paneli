import type { Edge } from "@xyflow/react";
import type { Switch, SwitchPort } from "../../types";

// Bakır (RJ45) port bağlantıları topolojide ARTIK ÇİZİLMİYOR (kullanıcı
// isteği) — switch_ports verisi/kart sekmesi/port düzenleme aynen duruyor,
// sadece bu görsel katmanda bakır-bakır bağlantılar atlanıyor (bkz. aşağıdaki
// `if (!isFiber) continue;`). Sadece fiber/SFP bağlantılar çiziliyor, bu
// yüzden tek bir stil sabiti (FIBER_STYLE) yeterli.
const FIBER_STYLE = {
  strokeDasharray: "1 4",
  stroke: "var(--color-warning)",
  strokeWidth: 1.75,
  opacity: 0.85
};
const FIBER_LABEL_STYLE = { fontSize: 10, fill: "var(--color-warning)", fontWeight: 600 };

/**
 * switch_ports'taki connection_type='switch' kayıtlarından topoloji edge'leri
 * türetir (Aşama 5). Çift taraflı senkron (Aşama 4) sayesinde bir bağlantının
 * iki ucu da (A port24→B, B port1→A) ayrı port kaydı olarak var olabilir —
 * aynı fiziksel bağlantıyı İKİ KEZ çizmemek için iki uç (switch_id, port_number)
 * ikilisine göre kanonik biçimde SIRALANIR (küçük olan önce) ve tek bir anahtar
 * (Map key) üretilir; aynı anahtarla ikinci kez karşılaşılırsa atlanır.
 * connected_port_number verilmemişse (Aşama 4 senaryosu: sadece switch seçili,
 * port yok) o uç için port -1 kabul edilir — bu durumda karşı tarafta eşleşen
 * bir port kaydı zaten OLAMAZ (senkron sadece port numarası verilince eşler),
 * dolayısıyla yanlışlıkla iki farklı bağlantının birleşmesi riski yoktur.
 *
 * Fiber/SFP kuralı: bağlantının HERHANGİ bir ucu (bizim port_type'ımız VEYA,
 * karşı port numarası biliniyorsa, karşı portun port_type'ı) 'sfp' ise çizgi
 * ÇİZİLİR (fiber stiliyle) — bir uç bakır (RJ45) bir uç SFP olsa bile (ör.
 * medya dönüştürücü senaryosu) fiziksel hattın en az bir ucu optik olduğundan
 * "herhangi biri SFP ise fiber" kuralı benimsendi. Bu hesap iki uçtan hangisi
 * önce işlenirse işlensin simetriktir (OR işlemi), dedup anahtarından
 * bağımsız olarak aynı sonucu verir.
 *
 * Her iki ucu da bakırsa (isFiber=false) topolojide HİÇ ÇİZİLMEZ — kullanıcı
 * isteği: bakır bağlantılar görsel olarak gürültü yaratıyordu. Bu SADECE bu
 * görsel katmanı etkiler; switch_ports verisi, kart sekmesi, port düzenleme
 * formu aynen çalışmaya devam eder, hiçbir veri silinmez/değişmez.
 *
 * switch_links (elle çizilen topoloji bağlantıları) bu fonksiyona hiç girmez,
 * ayrı bir state olarak kalmaya devam eder — burada sadece EK bir edge katmanı
 * üretiliyor.
 */
export function deriveSwitchPortEdges(
  switches: Pick<Switch, "id">[],
  portsBySwitchId: Map<string, SwitchPort[]>
): Edge[] {
  const knownSwitchIds = new Set(switches.map((s) => s.id));
  const seen = new Map<string, Edge>();

  for (const [switchId, ports] of portsBySwitchId) {
    for (const port of ports) {
      if (port.connection_type !== "switch" || !port.connected_switch_id) continue;
      const otherSwitchId = port.connected_switch_id;
      if (!knownSwitchIds.has(otherSwitchId)) continue;

      const p1 = port.port_number;
      const p2 = port.connected_port_number;

      const endpointA = { sw: switchId, p: p1 };
      const endpointB = { sw: otherSwitchId, p: p2 ?? -1 };

      const aFirst =
        endpointA.sw < endpointB.sw || (endpointA.sw === endpointB.sw && endpointA.p <= endpointB.p);
      const [first, second] = aFirst ? [endpointA, endpointB] : [endpointB, endpointA];

      const key = `${first.sw}:${first.p}--${second.sw}:${second.p}`;
      if (seen.has(key)) continue;

      const peerPort = p2 !== null ? portsBySwitchId.get(otherSwitchId)?.find((p) => p.port_number === p2) : undefined;
      const isFiber = port.port_type === "sfp" || peerPort?.port_type === "sfp";
      if (!isFiber) continue;

      const baseLabel = p2 !== null ? `${p1} ↔ ${p2}` : `port ${p1}`;
      const label = `${baseLabel} (SFP)`;

      seen.set(key, {
        id: `port-link-${key}`,
        source: switchId,
        target: otherSwitchId,
        label,
        style: FIBER_STYLE,
        labelStyle: FIBER_LABEL_STYLE,
        labelBgStyle: { fill: "var(--color-surface)", fillOpacity: 0.85 },
        selectable: false,
        data: { derived: true }
      });
    }
  }

  return Array.from(seen.values());
}
