import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/**
 * "Şimdi Kontrol Et" ile alınan ping sonucuna göre bağlantı üzerinde akan
 * küçük paket animasyonu (Packet Tracer esintili, ama ince/zarif — 2 küçük
 * nokta, dikkat dağıtmayan). Path, react-flow'un varsayılan 'default' edge
 * tipinin kullandığı AYNI `getBezierPath` fonksiyonuyla (aynı curvature ile)
 * hesaplanıyor — çizginin kendisi (stil, dedup, eğrilik) BİREBİR aynı kalıyor,
 * sadece üstüne `pointerEvents:none` bir SVG animasyon katmanı ekleniyor.
 *
 * Yön/hedef belirsizliği: bir bağlantının hangi ucunun mantıksal "hedef"
 * olduğu veri modelinde yok (switch_links/port bağlantıları yönsüz). Bu
 * yüzden: her iki uç da çevrimiçiyse paket kaynaktan hedefe DÜZ akar
 * (data.source dizilişi neyse o, sağlıklı akış). Herhangi bir uç
 * çevrimdışıysa paket HER ZAMAN çevrimiçi olan uçtan çevrimdışı olan uca
 * doğru hareket eder ve yolun ~%55'inde sönüp kaybolur — "paket çıktı ama
 * karşıya ulaşmadı" hissi, hangi ucun DB'de source/target olduğundan
 * bağımsız olarak doğru yönde gösterilir.
 *
 * `data.packet` tanımsızsa (ping hiç çalıştırılmadı VEYA edge sayısı
 * performans sınırını aştı) HİÇBİR animasyon elemanı render edilmez —
 * sadece normal statik çizgi, önceki davranışla aynı. Çevrimdışı
 * switch'lerin kırmızı göstergesi (SwitchNode.isOffline) bu katmandan
 * TAMAMEN BAĞIMSIZ, pingResult'a bağlı ve kalıcıdır.
 *
 * ÖNEMLİ (tarayıcı kısıtı): `<animateMotion>`'a SAYISAL bir `repeatCount`
 * (ör. 1, 2) verildiğinde bu ortamda animasyon HİÇ BAŞLAMIYOR (test edildi —
 * repeatCount="indefinite" çalışıyor, herhangi bir sonlu sayı çalışmıyor).
 * Bu yüzden SMIL'i her zaman `indefinite` döngüde bırakıyoruz (güvenilir
 * çalışan tek mod) ve "birkaç saniye akıp yumuşakça dur" davranışını SMIL
 * DIŞINDA, CSS `opacity` + `transition` ile sağlıyoruz: `packet.active`
 * false olunca bu katman CSS ile yumuşakça solar, SMIL döngüsü arka planda
 * (görünmez) dönmeye devam eder — ucuz ve sert kesme yapmaz.
 */
export interface PacketEdgeData extends Record<string, unknown> {
  derived?: boolean;
  packet?: {
    state: "healthy" | "failing";
    /** true ise paket target(1) -> source(0) yönünde akar (kaynak çevrimdışıysa). */
    reverse: boolean;
    /** false olunca katman CSS ile yumuşakça solar (SMIL döngüsü durmaz, sadece görünmez olur). */
    active: boolean;
  };
}

const HEALTHY_COLOR = "var(--color-success)";
const FAILING_COLOR = "var(--color-danger)";
const HEALTHY_DUR = "2.4s";
const FAILING_DUR = "1.6s";
const FAIL_TRAVEL = 0.55;
const FADE_TRANSITION = "opacity 0.6s ease";

export default function PacketEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  pathOptions,
  data
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: (pathOptions as { curvature?: number } | undefined)?.curvature
  });

  const packet = (data as PacketEdgeData | undefined)?.packet;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
        label={label}
        labelStyle={labelStyle}
        labelBgStyle={labelBgStyle}
      />

      {packet && (
        <g style={{ pointerEvents: "none", opacity: packet.active ? 1 : 0, transition: FADE_TRANSITION }}>
          {packet.state === "healthy" ? (
            <>
              <circle r={2.2} fill={HEALTHY_COLOR}>
                <animateMotion path={path} dur={HEALTHY_DUR} begin="0s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0;0.85;0.85;0"
                  keyTimes="0;0.06;0.94;1"
                  dur={HEALTHY_DUR}
                  begin="0s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle r={2.2} fill={HEALTHY_COLOR}>
                <animateMotion path={path} dur={HEALTHY_DUR} begin="1.2s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0;0.85;0.85;0"
                  keyTimes="0;0.06;0.94;1"
                  dur={HEALTHY_DUR}
                  begin="1.2s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          ) : (
            <>
              <circle r={2.4} fill={FAILING_COLOR}>
                <animateMotion
                  path={path}
                  keyPoints={packet.reverse ? `1;${1 - FAIL_TRAVEL};${1 - FAIL_TRAVEL}` : `0;${FAIL_TRAVEL};${FAIL_TRAVEL}`}
                  keyTimes="0;0.7;1"
                  dur={FAILING_DUR}
                  begin="0s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;1;0;0"
                  keyTimes="0;0.55;0.7;1"
                  dur={FAILING_DUR}
                  begin="0s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle r={2.4} fill={FAILING_COLOR}>
                <animateMotion
                  path={path}
                  keyPoints={packet.reverse ? `1;${1 - FAIL_TRAVEL};${1 - FAIL_TRAVEL}` : `0;${FAIL_TRAVEL};${FAIL_TRAVEL}`}
                  keyTimes="0;0.7;1"
                  dur={FAILING_DUR}
                  begin="0.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="1;1;0;0"
                  keyTimes="0;0.55;0.7;1"
                  dur={FAILING_DUR}
                  begin="0.8s"
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}
        </g>
      )}
    </>
  );
}
