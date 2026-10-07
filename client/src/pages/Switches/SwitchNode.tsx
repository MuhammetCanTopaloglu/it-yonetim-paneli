import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { InventoryItem, Switch, SwitchPort } from "../../types";
import { computeNodeSize } from "./portGridLayout";
import PortGrid from "./PortGrid";

/**
 * Fiziksel switch görünümü: üstte ad + model/IP, altında port_count'a göre
 * otomatik satırlara bölünen bir port ızgarası (PortGrid — kart sekmesiyle
 * paylaşılan tek kaynak). Portlar tıklanabilir (Aşama 4): PortGrid kendi
 * içinde nodrag/nopan + stopPropagation uyguluyor, node sürükleme ve
 * canvas pan'i bozmuyor.
 */
export interface SwitchNodeData extends Record<string, unknown> {
  label: string;
  model?: string | null;
  managementIp?: string | null;
  portCount?: number | null;
  ports: SwitchPort[];
  allSwitches: Switch[];
  inventory: InventoryItem[];
  onPortClick?: (switchId: string, port: SwitchPort) => void;
  /**
   * Son ping kontrolüne göre bu switch çevrimdışı mı? `undefined`/`false` =
   * normal görünüm (henüz kontrol edilmemiş, çevrimiçi, VEYA management_ip
   * tanımlı değil — backend management_ip'siz switch'lere zaten ping atmıyor,
   * bu yüzden onlar hiçbir zaman "true" olmaz, yanlışlıkla çevrimdışı
   * görünmezler). Sadece `true` olduğunda kırmızı gösterge eklenir — port
   * ızgarasına/tıklamaya hiç dokunmuyor, sadece dışa bir katman.
   */
  isOffline?: boolean;
  /**
   * Etki analizi (blast radius) katmanı — ping'den TAMAMEN bağımsız, ayrı bir
   * prop (bkz. TopologyTab'daki impactState useMemo'su). "root" = analiz
   * edilen switch, "affected" = onun düşmesiyle omurgaya ulaşamayan switch,
   * undefined/"normal" = analiz kapalı veya bu switch etkilenmiyor. SADECE
   * dışa eklenen bir görsel katman (kesikli kırmızı çerçeve/rozet) — port
   * ızgarasına, tıklamaya, sürüklemeye hiç dokunmuyor (isOffline ile aynı ilke).
   */
  impactState?: "root" | "affected";
}

export default function SwitchNode({ id, data }: NodeProps) {
  const d = data as SwitchNodeData;
  const ports = d.ports ?? [];
  const copperCount = ports.filter((p) => p.port_type !== "sfp").length;
  const sfpCount = ports.filter((p) => p.port_type === "sfp").length;
  const { width, height } = computeNodeSize(copperCount, sfpCount);
  const subtitle = [d.model, d.managementIp].filter(Boolean).join(" · ");

  return (
    <div
      className={`relative rounded-md border bg-surface text-primary shadow-sm flex flex-col ${
        d.isOffline ? "border-danger" : ""
      } ${d.impactState === "affected" ? "opacity-50" : ""}`}
      style={{
        width,
        height,
        ...(d.isOffline ? { boxShadow: "0 0 0 1px var(--color-danger)" } : undefined)
      }}
    >
      {d.isOffline && (
        <div
          title="Son ping kontrolünde çevrimdışı"
          className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-danger border-2 border-surface z-10"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Etki analizi katmanı — isOffline'dan bağımsız, ayrı bir overlay
          (port ızgarası/tıklama/sürüklemeye hiç dokunmuyor, sadece görsel). */}
      {d.impactState === "root" && (
        <div
          title="Analiz edilen switch"
          className="absolute inset-0 rounded-md border-2 border-accent z-10"
          style={{ pointerEvents: "none" }}
        />
      )}
      {d.impactState === "affected" && (
        <div
          title="Bu switch etkileniyor"
          className="absolute inset-0 rounded-md border-2 border-dashed border-danger z-10"
          style={{ pointerEvents: "none" }}
        />
      )}

      <Handle type="target" position={Position.Top} />

      <div className="px-2.5 pt-1.5 pb-1 border-b shrink-0">
        <div className="text-xs font-medium truncate">{d.label}</div>
        {subtitle && <div className="text-[10px] text-tertiary truncate">{subtitle}</div>}
      </div>

      {ports.length > 0 && (
        <div className="p-2.5 flex-1 flex items-center">
          <PortGrid
            ports={ports}
            inventory={d.inventory ?? []}
            switches={d.allSwitches ?? []}
            onPortClick={d.onPortClick ? (port) => d.onPortClick!(id, port) : undefined}
          />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
