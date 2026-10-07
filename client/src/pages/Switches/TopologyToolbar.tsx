import { useReactFlow, Panel } from "@xyflow/react";
import type { RefObject } from "react";

/**
 * Düzenleme Modu anahtarı + annotation ekleme butonları. `<Panel>` içinde,
 * yani `<ReactFlow>`'un kendi oluşturduğu provider bağlamının İÇİNDE render
 * ediliyor — bu yüzden `useReactFlow()` burada kullanılabiliyor (TopologyTab
 * bileşeninin kendisi provider dışında olduğu için orada kullanılamaz).
 *
 * "+ Bölge"/"+ Not" tıklanınca `screenToFlowPosition` ile canvas'ın GÖRÜNÜR
 * merkezinin flow-koordinatını hesaplıyoruz (wrapper'ın ekran konumunu
 * `wrapperRef` ile alıp ortasını flow koordinatına çeviriyoruz) — böylece
 * yeni annotation nereye kaydırılmış/yakınlaştırılmış olursa olsun her zaman
 * o an EKRANDA GÖRÜNEN alanın ortasına düşüyor.
 */
export default function TopologyToolbar({
  editMode,
  onToggleEditMode,
  onAddRegion,
  onAddText,
  onAddBox,
  onAddArrow,
  wrapperRef,
  onPingCheck,
  pingLoading,
  impactMode,
  onToggleImpactMode
}: {
  editMode: boolean;
  onToggleEditMode: () => void;
  onAddRegion: (x: number, y: number) => void;
  onAddText: (x: number, y: number) => void;
  onAddBox: (x: number, y: number) => void;
  onAddArrow: (x: number, y: number) => void;
  wrapperRef: RefObject<HTMLDivElement | null>;
  onPingCheck: () => void;
  pingLoading: boolean;
  impactMode: boolean;
  onToggleImpactMode: () => void;
}) {
  const { screenToFlowPosition } = useReactFlow();

  function getVisibleCenter() {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return screenToFlowPosition({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    });
  }

  return (
    <Panel position="top-right" className="flex items-center gap-2">
      {editMode && (
        <div className="flex items-center gap-1.5 rounded-md border bg-surface shadow-card px-1.5 py-1">
          <button
            type="button"
            onClick={() => {
              const { x, y } = getVisibleCenter();
              onAddRegion(x - 110, y - 80);
            }}
            className="px-2.5 py-1 text-xs rounded hover:bg-surface-secondary text-secondary hover:text-primary transition-colors duration-150"
          >
            + Bölge
          </button>
          <button
            type="button"
            onClick={() => {
              const { x, y } = getVisibleCenter();
              onAddText(x, y);
            }}
            className="px-2.5 py-1 text-xs rounded hover:bg-surface-secondary text-secondary hover:text-primary transition-colors duration-150"
          >
            + Not
          </button>
          <button
            type="button"
            onClick={() => {
              const { x, y } = getVisibleCenter();
              onAddBox(x, y);
            }}
            className="px-2.5 py-1 text-xs rounded hover:bg-surface-secondary text-secondary hover:text-primary transition-colors duration-150"
          >
            + Kutu
          </button>
          <button
            type="button"
            onClick={() => {
              const { x, y } = getVisibleCenter();
              onAddArrow(x, y);
            }}
            className="px-2.5 py-1 text-xs rounded hover:bg-surface-secondary text-secondary hover:text-primary transition-colors duration-150"
          >
            + Ok
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onPingCheck}
        disabled={pingLoading}
        className="px-3 py-1.5 text-xs font-medium rounded-md border bg-surface text-secondary hover:text-primary hover:bg-surface-secondary transition-colors duration-150 disabled:opacity-50"
      >
        {pingLoading ? "Kontrol ediliyor..." : "📡 Şimdi Kontrol Et"}
      </button>

      <button
        type="button"
        onClick={onToggleImpactMode}
        aria-pressed={impactMode}
        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 ${
          impactMode
            ? "bg-accent text-white border-accent"
            : "bg-surface text-secondary hover:text-primary hover:bg-surface-secondary"
        }`}
      >
        {impactMode ? "⚡ Etki Analizi: Açık" : "⚡ Etki Analizi"}
      </button>

      <button
        type="button"
        onClick={onToggleEditMode}
        aria-pressed={editMode}
        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 ${
          editMode
            ? "bg-accent text-white border-accent"
            : "bg-surface text-secondary hover:text-primary hover:bg-surface-secondary"
        }`}
      >
        {editMode ? "✎ Düzenleme Modu: Açık" : "✎ Düzenleme Modu"}
      </button>
    </Panel>
  );
}
