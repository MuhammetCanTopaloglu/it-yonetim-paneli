import { NodeResizer, type NodeProps } from "@xyflow/react";

/**
 * Bölge/alan kutusu. Switch node'larının ARKASINDA durması için TopologyTab
 * bu node'ları hem `nodes` dizisinde switch node'larından ÖNCE ekliyor hem
 * de düşük bir `zIndex` veriyor (çift garanti) — bu, Düzenleme Modu açık/
 * kapalı FARK ETMEKSİZİN her zaman geçerli.
 *
 * width/height DB'den geliyor ve AÇIKÇA node'a veriliyor (SwitchNode ile aynı
 * prensip) — ResizeObserver ölçümüne asla bırakılmıyor. Boyutlandırma
 * (NodeResizer) bittiğinde de sonuç yine AÇIK width/height olarak node'a geri
 * veriliyor (TopologyTab'daki `annotations` state'i üzerinden), asla ölçüme
 * bırakılmıyor.
 *
 * Düzenleme Modu KAPALIYKEN (data.editMode=false): `pointerEvents:'none'` +
 * TopologyTab'da `draggable:false, selectable:false` — bir switch bu kutunun
 * üstünde dursa bile tıklama/sürükleme switch'e gider, region hiç araya girmez.
 * `NodeResizer isVisible={false}` ile boyutlandırma kolları da hiç görünmez.
 *
 * Düzenleme Modu AÇIKKEN (data.editMode=true): `pointerEvents:'auto'` +
 * `draggable:true, selectable:true` olur — region artık tıklanıp
 * sürüklenebilir, `NodeResizer` kolları görünür olur. Bu durumda bile bir
 * switch region'ın üstündeyse switch ETKİLENMEZ: switch her zaman region'dan
 * SONRA render edilip daha yüksek zIndex'te olduğundan, üst üste bindikleri
 * pikselde tarayıcı olayı switch'e yönlendirir.
 *
 * Canlı önizleme + tek yazım ikiye ayrılmış (switch/annotation sürüklemesiyle
 * AYNI desen): `onResize` sürükleme sırasında HER ADIMDA tetiklenir ve
 * SADECE local `annotations` state'ini günceller (`d.onResize` — API çağrısı
 * YOK) — bu, node'un width/height'ının (yukarıdaki `width`/`height` prop'u,
 * TopologyTab'daki `annotations` state'inden gelir) anlık değişmesini sağlar,
 * yani react-flow'un kendi iç önizlemesine güvenmek yerine BİZİM state'imiz
 * mouse'u canlı takip eder (node yine AÇIK width/height alıyor — sadece artık
 * bu değer sürükleme sırasında da her karede güncelleniyor, ResizeObserver'a
 * hâlâ hiç düşmüyor). `onResizeEnd` sürükleme BİTİNCE bir kez daha çağrılır,
 * o an TEK bir PATCH atılır — spam yok.
 */
export interface RegionNodeData extends Record<string, unknown> {
  label: string | null;
  color: string | null;
  editMode: boolean;
  onResize?: (dims: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (dims: { x: number; y: number; width: number; height: number }) => void;
}

const DEFAULT_COLOR = "#94a0b2";
const MIN_WIDTH = 80;
const MIN_HEIGHT = 60;

export default function RegionNode({ data, width, height, selected }: NodeProps) {
  const d = data as RegionNodeData;
  const color = d.color ?? DEFAULT_COLOR;

  return (
    <>
      <NodeResizer
        isVisible={d.editMode}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        color={color}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
        onResize={(_event, params) => {
          d.onResize?.({ x: params.x, y: params.y, width: params.width, height: params.height });
        }}
        onResizeEnd={(_event, params) => {
          d.onResizeEnd?.({ x: params.x, y: params.y, width: params.width, height: params.height });
        }}
      />
      <div
        style={{
          width: width ?? 200,
          height: height ?? 150,
          pointerEvents: d.editMode ? "auto" : "none",
          cursor: d.editMode ? "grab" : "default",
          border: `1.5px ${d.editMode && selected ? "solid" : "dashed"} ${color}`,
          backgroundColor: `${color}14`,
          borderRadius: 10,
          boxShadow: d.editMode && selected ? `0 0 0 2px ${color}66` : undefined
        }}
      >
        {d.label && (
          <div
            style={{ color }}
            className="px-2.5 py-1 text-xs font-medium truncate"
          >
            {d.label}
          </div>
        )}
      </div>
    </>
  );
}
