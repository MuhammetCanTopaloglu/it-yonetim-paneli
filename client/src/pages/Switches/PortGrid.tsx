import type { InventoryItem, Switch, SwitchPort, SwitchPortStatus } from "../../types";
import { PORT_GAP, PORT_SIZE, SFP_SEPARATOR_GAP, computeNodeSize } from "./portGridLayout";

const STATUS_CLASS: Record<SwitchPortStatus, string> = {
  bos: "bg-surface-secondary border border-tertiary/30",
  dolu: "bg-success border border-success",
  kapali: "bg-danger border border-danger",
  uplink: "bg-accent border border-accent"
};

export function formatPortTooltip(port: SwitchPort, inventory: InventoryItem[], switches: Switch[]): string {
  const base = `Port ${port.port_number}`;

  if (port.status === "bos") return `${base} → Boş`;
  if (port.status === "kapali") return `${base} → Kapalı`;

  if (port.connection_type === "inventory" && port.connected_inventory_id) {
    const name = inventory.find((i) => i.id === port.connected_inventory_id)?.name ?? "(silinmiş cihaz)";
    return `${base} → ${name}`;
  }
  if (port.connection_type === "switch" && port.connected_switch_id) {
    const target = switches.find((s) => s.id === port.connected_switch_id)?.name ?? "(silinmiş switch)";
    return port.connected_port_number ? `${base} → ${target} port ${port.connected_port_number}` : `${base} → ${target}`;
  }
  if (port.connection_type === "other" && port.connected_label) {
    return `${base} → ${port.connected_label}`;
  }

  return `${base} → ${port.status === "uplink" ? "Uplink" : "Dolu"}`;
}

/**
 * Fiziksel switch port ızgarası — hem Switch Yönetimi > Topoloji (SwitchNode
 * içinde) hem Detay/Kart sekmesinde (PortsSection içinde) kullanılan TEK
 * kaynak. Boyut hesabı portGridLayout.ts ile paylaşılır ki ikisi asla sapmasın.
 *
 * `nodrag nopan` class'ları: react-flow canvas'ı içinde render edilirken bir
 * porta tıklamanın node sürüklemeyi veya canvas pan'ini tetiklememesi için —
 * Handle bileşenlerinde zaten kullandığımız aynı desen. Kart sekmesinde bu
 * class'ların hiçbir etkisi yok (zararsız).
 */
export default function PortGrid({
  ports,
  inventory,
  switches,
  onPortClick
}: {
  ports: SwitchPort[];
  inventory: InventoryItem[];
  switches: Switch[];
  onPortClick?: (port: SwitchPort) => void;
}) {
  const copperPorts = ports.filter((p) => p.port_type !== "sfp").sort((a, b) => a.port_number - b.port_number);
  const sfpPorts = ports.filter((p) => p.port_type === "sfp").sort((a, b) => a.port_number - b.port_number);
  const { copper, sfp, gridWidth } = computeNodeSize(copperPorts.length, sfpPorts.length);

  if (ports.length === 0) {
    return <p className="text-xs text-tertiary">Port bulunamadı.</p>;
  }

  function renderPortButton(port: SwitchPort) {
    return (
      <button
        key={port.id}
        type="button"
        title={formatPortTooltip(port, inventory, switches)}
        onClick={(e) => {
          e.stopPropagation();
          onPortClick?.(port);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`nodrag nopan rounded-[2px] transition-transform duration-100 ${STATUS_CLASS[port.status]} ${
          onPortClick ? "cursor-pointer hover:scale-125 hover:z-10 relative" : "cursor-default"
        }`}
        style={{ width: PORT_SIZE, height: PORT_SIZE }}
      />
    );
  }

  return (
    <div className="nodrag nopan" style={{ width: gridWidth }}>
      <div
        className="grid content-start"
        style={{
          gridTemplateColumns: `repeat(${copper.portsPerRow}, ${PORT_SIZE}px)`,
          gap: PORT_GAP
        }}
      >
        {copperPorts.map(renderPortButton)}
      </div>

      {sfpPorts.length > 0 && (
        <div style={{ marginTop: SFP_SEPARATOR_GAP }}>
          <div className="text-[8px] leading-none text-tertiary tracking-wide mb-[2px]">SFP</div>
          <div
            className="grid content-start"
            style={{
              gridTemplateColumns: `repeat(${sfp.portsPerRow}, ${PORT_SIZE}px)`,
              gap: PORT_GAP
            }}
          >
            {sfpPorts.map(renderPortButton)}
          </div>
        </div>
      )}
    </div>
  );
}
