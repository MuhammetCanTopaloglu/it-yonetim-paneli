import { useCallback, useRef } from "react";
import { useViewport } from "@xyflow/react";
import type { TopologyAnnotation } from "../../types";

/**
 * Serbest metin notları artık react-flow NODE'u DEĞİL — canvas'ın üstünde
 * ayrı, plain bir DOM katmanı (bu bileşen). Sebep: react-flow bir node'u
 * sürüklerken/seçerken DOM'a yazdığı z-index'i bizim `!important` CSS
 * kuralımızla bile öngörülemez şekilde geçici olarak değiştirebiliyordu
 * (bkz. önceki turların z-index/DOM-sıra denemeleri). Notlar artık react-flow
 * node yaşam döngüsüne hiç girmediği için o sorun kökten ortadan kalkıyor —
 * her zaman bu overlay'in DOM sırasına göre (switch'lerden SONRA, en üstte)
 * render olur, react-flow'un iç state'i onu asla etkilemez.
 *
 * Pan/zoom senkronu: `useViewport()` react-flow'un GERÇEK viewport'unu
 * ({x, y, zoom}) reaktif olarak okur (bu bileşen <ReactFlow>'un İÇİNDE,
 * yani ReactFlowProvider bağlamında render edildiği için kullanılabilir).
 * Bir notun ekran konumu, react-flow'un node'ları konumlandırmak için
 * kullandığı AYNI formülle hesaplanıyor: react-flow içeriği
 * `translate(vx,vy) scale(zoom)` ile dönüştürüyor, yani
 * screenX = canvasX*zoom + vx, screenY = canvasY*zoom + vy. Bu, notun
 * switch'lerle pan/zoom sırasında BİREBİR aynı hareket etmesini garantiler.
 *
 * Boyut: okunabilirlik için scale 0.7–1.3 arasında clamp'leniyor — pozisyon
 * tam (clamp'siz) zoom ile hesaplanıyor (hizanın bozulmaması için), sadece
 * görsel BÜYÜKLÜK aşırı küçülüp okunmaz olmasın diye sınırlanıyor.
 *
 * Etkileşim: Düzenleme Modu kapalıyken üst katman `pointerEvents:none` —
 * altındaki switch/port'a hiç karışmaz (mevcut kural korunuyor). Açıkken
 * her notun kendisi `pointerEvents:auto` olup sürüklenebilir/çift tıkla
 * düzenlenebilir hale geliyor; sürükleme ekran-pikseli farkını `/zoom` ile
 * canvas birimine çevirip switch/region sürüklemesindeki AYNI "sürüklerken
 * local state, bırakınca tek PATCH" desenini izliyor.
 */

const MIN_SCALE = 0.7;
const MAX_SCALE = 1.3;

const DEFAULT_SHAPE_COLOR = "#1670a6";
const DEFAULT_BOX_WIDTH = 180;
const DEFAULT_BOX_HEIGHT = 110;
const MIN_BOX_SIZE = 30;

type ShapeDragMode = "move" | "resize" | "start" | "end";

interface ShapeDims {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function AnnotationOverlay({
  annotations,
  shapeAnnotations,
  editMode,
  onLiveMove,
  onMoveEnd,
  onShapeMove,
  onShapeMoveEnd,
  onDoubleClick
}: {
  annotations: TopologyAnnotation[];
  shapeAnnotations: TopologyAnnotation[];
  editMode: boolean;
  onLiveMove: (id: string, x: number, y: number) => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
  onShapeMove: (id: string, dims: ShapeDims) => void;
  onShapeMoveEnd: (id: string, dims: ShapeDims) => void;
  onDoubleClick: (annotation: TopologyAnnotation) => void;
}) {
  const { x: vx, y: vy, zoom } = useViewport();
  const dragState = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    zoom: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragState.current;
      if (!drag) return;
      const deltaScreenX = e.clientX - drag.startClientX;
      const deltaScreenY = e.clientY - drag.startClientY;
      const newX = drag.startX + deltaScreenX / drag.zoom;
      const newY = drag.startY + deltaScreenY / drag.zoom;
      drag.lastX = newX;
      drag.lastY = newY;
      onLiveMove(drag.id, newX, newY);
    },
    [onLiveMove]
  );

  const handlePointerUp = useCallback(() => {
    const drag = dragState.current;
    if (!drag) return;
    dragState.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    onMoveEnd(drag.id, drag.lastX, drag.lastY);
  }, [handlePointerMove, onMoveEnd]);

  function handlePointerDown(e: React.PointerEvent, annotation: TopologyAnnotation) {
    if (!editMode) return;
    e.stopPropagation();
    dragState.current = {
      id: annotation.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: annotation.x,
      startY: annotation.y,
      zoom,
      lastX: annotation.x,
      lastY: annotation.y
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  // Kutu/ok için AYRI bir sürükleme state'i — metin notunun kanıtlanmış
  // sürükleme koduna dokunmadan (regresyon riskini sıfırlamak için), aynı
  // "sürüklerken local state, bırakınca tek PATCH" deseniyle ama 4 farklı
  // modu destekleyecek şekilde: move (tüm şekli taşı), resize (kutunun
  // sağ-alt köşesinden boyutlandır — x/y sabit kalır), start/end (okun
  // sadece o ucunu taşı — diğer uç sabit kalır, width/height buna göre
  // yeniden hesaplanır çünkü ok'un bitiş noktası x+width, y+height olarak
  // saklanıyor).
  const shapeDragState = useRef<{
    id: string;
    mode: ShapeDragMode;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    zoom: number;
    last: ShapeDims;
  } | null>(null);

  const handleShapePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = shapeDragState.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startClientX) / drag.zoom;
      const dy = (e.clientY - drag.startClientY) / drag.zoom;

      let next: ShapeDims;
      if (drag.mode === "move") {
        next = { x: drag.startX + dx, y: drag.startY + dy, width: drag.startWidth, height: drag.startHeight };
      } else if (drag.mode === "resize") {
        next = {
          x: drag.startX,
          y: drag.startY,
          width: Math.max(MIN_BOX_SIZE, drag.startWidth + dx),
          height: Math.max(MIN_BOX_SIZE, drag.startHeight + dy)
        };
      } else if (drag.mode === "start") {
        next = { x: drag.startX + dx, y: drag.startY + dy, width: drag.startWidth - dx, height: drag.startHeight - dy };
      } else {
        next = { x: drag.startX, y: drag.startY, width: drag.startWidth + dx, height: drag.startHeight + dy };
      }

      drag.last = next;
      onShapeMove(drag.id, next);
    },
    [onShapeMove]
  );

  const handleShapePointerUp = useCallback(() => {
    const drag = shapeDragState.current;
    if (!drag) return;
    shapeDragState.current = null;
    window.removeEventListener("pointermove", handleShapePointerMove);
    window.removeEventListener("pointerup", handleShapePointerUp);
    onShapeMoveEnd(drag.id, drag.last);
  }, [handleShapePointerMove, onShapeMoveEnd]);

  function handleShapePointerDown(e: React.PointerEvent | { clientX: number; clientY: number }, annotation: TopologyAnnotation, mode: ShapeDragMode) {
    if (!editMode) return;
    if ("stopPropagation" in e) e.stopPropagation();
    const width = annotation.width ?? 0;
    const height = annotation.height ?? 0;
    shapeDragState.current = {
      id: annotation.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: annotation.x,
      startY: annotation.y,
      startWidth: width,
      startHeight: height,
      zoom,
      last: { x: annotation.x, y: annotation.y, width, height }
    };
    window.addEventListener("pointermove", handleShapePointerMove);
    window.addEventListener("pointerup", handleShapePointerUp);
  }

  const boxAnnotations = shapeAnnotations.filter((a) => a.shape_kind === "box");
  const arrowAnnotations = shapeAnnotations.filter((a) => a.shape_kind === "arrow");

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: "none", zIndex: 1000 }}
    >
      {annotations.map((a) => {
        const left = a.x * zoom + vx;
        const top = a.y * zoom + vy;
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, zoom));
        const color = a.color ?? "#c8850f";

        return (
          <div
            key={a.id}
            onPointerDown={(e) => handlePointerDown(e, a)}
            onDoubleClick={(e) => {
              if (!editMode) return;
              e.stopPropagation();
              onDoubleClick(a);
            }}
            style={{
              position: "absolute",
              left,
              top,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              pointerEvents: editMode ? "auto" : "none",
              cursor: editMode ? "grab" : "default",
              minWidth: 160,
              maxWidth: 280,
              color,
              backgroundColor: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
              border: `1px solid ${color}`,
              borderRadius: 6,
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)"
            }}
            className="px-2.5 py-1.5 text-xs font-medium"
          >
            {a.text}
          </div>
        );
      })}

      {/* Kutu (box): region'dan görsel olarak ayrışsın diye DÜZ (kesiksiz)
          çerçeve, dolgu neredeyse yok — region'ın kesikli/etiketli "alan"
          görünümünden farklı, basit bir vurgulama dikdörtgeni. Sağ-alt
          köşedeki küçük tutamaç sadece boyut değiştirir (x/y sabit kalır);
          gövdeye tıklayıp sürüklemek tüm kutuyu taşır. */}
      {boxAnnotations.map((a) => {
        const left = a.x * zoom + vx;
        const top = a.y * zoom + vy;
        const width = (a.width ?? DEFAULT_BOX_WIDTH) * zoom;
        const height = (a.height ?? DEFAULT_BOX_HEIGHT) * zoom;
        const color = a.color ?? DEFAULT_SHAPE_COLOR;

        return (
          <div
            key={a.id}
            onPointerDown={(e) => handleShapePointerDown(e, a, "move")}
            onDoubleClick={(e) => {
              if (!editMode) return;
              e.stopPropagation();
              onDoubleClick(a);
            }}
            style={{
              position: "absolute",
              left,
              top,
              width,
              height,
              border: `2px solid ${color}`,
              borderRadius: 4,
              backgroundColor: `${color}0d`,
              pointerEvents: editMode ? "auto" : "none",
              cursor: editMode ? "grab" : "default"
            }}
          >
            {editMode && (
              // Görünen tutamaç 12px ama gerçek tıklama/sürükleme hedefi 22px —
              // küçük bir görsel nokta fareyle hassas yakalanamayacağı için
              // hit-alanı büyütülüyor (iç nokta pointerEvents:none, tıklama her
              // zaman dış div'e düşer).
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handleShapePointerDown(e, a, "resize");
                }}
                style={{
                  position: "absolute",
                  right: -11,
                  bottom: -11,
                  width: 22,
                  height: 22,
                  cursor: "nwse-resize",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: color,
                    border: "1.5px solid white",
                    pointerEvents: "none"
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Ok (arrow): x,y başlangıç; width/height bitiş noktasına göre OFSET
          (bitiş = x+width, y+height) — negatif olabilir (yukarı/sola giden
          ok). Görünür çizgi pointerEvents:none, üstündeki görünmez kalın
          çizgi (sadece edit modda) sürüklenebilir gövde. İki ucu ayrı birer
          daire tutamaçla bağımsız taşınabiliyor. */}
      <svg className="absolute inset-0" style={{ pointerEvents: "none", overflow: "visible" }} width="100%" height="100%">
        <defs>
          {arrowAnnotations.map((a) => (
            <marker
              key={`marker-${a.id}`}
              id={`arrowhead-${a.id}`}
              markerWidth={8}
              markerHeight={8}
              refX={6}
              refY={4}
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill={a.color ?? DEFAULT_SHAPE_COLOR} />
            </marker>
          ))}
        </defs>
        {arrowAnnotations.map((a) => {
          const x1 = a.x * zoom + vx;
          const y1 = a.y * zoom + vy;
          const x2 = (a.x + (a.width ?? 0)) * zoom + vx;
          const y2 = (a.y + (a.height ?? 0)) * zoom + vy;
          const color = a.color ?? DEFAULT_SHAPE_COLOR;

          return (
            <g key={a.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2.5} markerEnd={`url(#arrowhead-${a.id})`} />
              {editMode && (
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: "stroke", cursor: "grab" }}
                  onPointerDown={(e) => handleShapePointerDown(e, a, "move")}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDoubleClick(a);
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>
      {editMode &&
        arrowAnnotations.map((a) => {
          const x1 = a.x * zoom + vx;
          const y1 = a.y * zoom + vy;
          const x2 = (a.x + (a.width ?? 0)) * zoom + vx;
          const y2 = (a.y + (a.height ?? 0)) * zoom + vy;
          const color = a.color ?? DEFAULT_SHAPE_COLOR;
          // Görünen daire 12px ama gerçek tıklama hedefi (border-box padding
          // ile) 22px — kutu tutamacındaki AYNI sebep: küçük dairesel hedefi
          // fareyle hassas yakalamak zor, hit-alanını büyütüyoruz.
          const handleStyle = (cx: number, cy: number): React.CSSProperties => ({
            position: "absolute",
            left: cx - 11,
            top: cy - 11,
            width: 22,
            height: 22,
            padding: 5,
            boxSizing: "border-box",
            pointerEvents: "auto",
            cursor: "grab"
          });
          const dotStyle = (): React.CSSProperties => ({
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: color,
            border: "2px solid white",
            pointerEvents: "none"
          });

          return (
            <div key={`handles-${a.id}`}>
              <div onPointerDown={(e) => handleShapePointerDown(e, a, "start")} style={handleStyle(x1, y1)}>
                <div style={dotStyle()} />
              </div>
              <div onPointerDown={(e) => handleShapePointerDown(e, a, "end")} style={handleStyle(x2, y2)}>
                <div style={dotStyle()} />
              </div>
            </div>
          );
        })}
    </div>
  );
}
