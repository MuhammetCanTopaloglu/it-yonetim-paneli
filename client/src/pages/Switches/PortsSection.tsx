import { useEffect, useState } from "react";
import { listSwitchPorts, updateSwitchPort } from "../../api/switchPorts";
import { useToast } from "../../components/Toast";
import Modal from "../../components/Modal";
import PortGrid from "./PortGrid";
import PortEditForm from "./PortEditForm";
import type { InventoryItem, Switch, SwitchPort, SwitchPortFormData } from "../../types";

export default function PortsSection({
  switchId,
  allSwitches,
  inventory
}: {
  switchId: string;
  allSwitches: Switch[];
  inventory: InventoryItem[];
}) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [ports, setPorts] = useState<SwitchPort[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPort, setEditingPort] = useState<SwitchPort | undefined>(undefined);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPorts(await listSwitchPorts(switchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (expanded && ports.length === 0) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  async function handleSavePort(data: SwitchPortFormData) {
    if (!editingPort) return;
    const result = await updateSwitchPort(editingPort.id, data);
    setPorts((prev) => prev.map((p) => (p.id === result.port.id ? result.port : p)));
    setEditingPort(undefined);
    if (result.warning) {
      showToast(result.warning, "danger");
    }
  }

  const otherSwitches = allSwitches.filter((s) => s.id !== switchId);

  return (
    <div className="mt-2 pt-2 border-t">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-accent hover:underline"
      >
        {expanded ? "Portları Gizle ▲" : "Portları Göster ▼"}
      </button>

      {expanded && (
        <div className="mt-2">
          {loading && <p className="text-xs text-tertiary">Yükleniyor...</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
          {!loading && !error && (
            <PortGrid
              ports={ports}
              inventory={inventory}
              switches={allSwitches}
              onPortClick={setEditingPort}
            />
          )}
        </div>
      )}

      {editingPort && (
        <Modal title={`Port ${editingPort.port_number}`} onClose={() => setEditingPort(undefined)}>
          <PortEditForm
            port={editingPort}
            switches={otherSwitches}
            inventory={inventory}
            onSubmit={handleSavePort}
            onCancel={() => setEditingPort(undefined)}
          />
        </Modal>
      )}
    </div>
  );
}
