import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createSwitch, deleteSwitch, listSwitches, updateSwitch } from "../../api/switches";
import { listInventory } from "../../api/inventory";
import type { InventoryItem, Switch, SwitchFormData } from "../../types";
import Modal from "../../components/Modal";
import SwitchForm from "./SwitchForm";
import PortsSection from "./PortsSection";
import SnmpQueryModal from "./SnmpQueryModal";
import NetworkDiscoveryModal from "./NetworkDiscoveryModal";

export default function SwitchCardsTab() {
  const [items, setItems] = useState<Switch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Switch | undefined>(undefined);
  const [deletingItem, setDeletingItem] = useState<Switch | undefined>(undefined);
  const [snmpItem, setSnmpItem] = useState<Switch | undefined>(undefined);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listSwitches(q);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    listInventory({}).then(setInventory).catch(() => {});
  }, []);

  function openCreate() {
    setEditingItem(undefined);
    setModalOpen(true);
  }

  function openEdit(item: Switch) {
    setEditingItem(item);
    setModalOpen(true);
  }

  async function handleSubmit(data: SwitchFormData, confirmPortRemoval = false) {
    if (editingItem) {
      await updateSwitch(editingItem.id, data, confirmPortRemoval);
    } else {
      await createSwitch(data, confirmPortRemoval);
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete() {
    if (!deletingItem) return;
    await deleteSwitch(deletingItem.id);
    setDeletingItem(undefined);
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <input
          placeholder="Ara: ad, model, IP, konum, VLAN..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 max-w-sm rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDiscoveryOpen(true)}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary text-secondary hover:text-primary transition-colors duration-150"
          >
            🔍 Ağı Tara
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
          >
            + Yeni Switch
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      {loading && <p className="text-sm text-tertiary">Yükleniyor...</p>}
      {!loading && items.length === 0 && <p className="text-sm text-tertiary">Kayıt bulunamadı</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border bg-surface p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">{item.name}</h3>
              <div className="space-x-2 text-xs">
                <button onClick={() => openEdit(item)} className="text-accent hover:underline">
                  Düzenle
                </button>
                <button onClick={() => setDeletingItem(item)} className="text-danger hover:underline">
                  Sil
                </button>
              </div>
            </div>
            <dl className="text-sm space-y-1 text-secondary">
              <div className="flex justify-between">
                <dt className="text-tertiary">Model</dt>
                <dd>{item.model || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tertiary">Yönetim IP</dt>
                <dd>{item.management_ip || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tertiary">Port Sayısı</dt>
                <dd>
                  {item.port_count ?? "—"}
                  {item.sfp_count > 0 ? ` (+${item.sfp_count} SFP)` : ""}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tertiary">VLAN</dt>
                <dd className="text-right">{item.vlans || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tertiary">Konum</dt>
                <dd>{item.location || "—"}</dd>
              </div>
              {item.notes && (
                <div className="pt-1 border-t mt-2 text-xs text-secondary">{item.notes}</div>
              )}
            </dl>
            <button
              onClick={() => setSnmpItem(item)}
              className="mt-3 w-full px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-surface-secondary text-secondary hover:text-primary transition-colors duration-150"
            >
              📶 SNMP ile Sorgula
            </button>
            <PortsSection switchId={item.id} allSwitches={items} inventory={inventory} />
          </div>
        ))}
      </div>

      {modalOpen && (
        <Modal title={editingItem ? "Switch Düzenle" : "Yeni Switch"} onClose={() => setModalOpen(false)}>
          <SwitchForm item={editingItem} onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} />
        </Modal>
      )}

      {snmpItem && <SnmpQueryModal item={snmpItem} onClose={() => setSnmpItem(undefined)} />}

      {discoveryOpen && (
        <NetworkDiscoveryModal
          existingIps={new Set(items.map((i) => i.management_ip).filter((ip): ip is string => Boolean(ip)))}
          onClose={() => setDiscoveryOpen(false)}
          onAdded={load}
        />
      )}

      {deletingItem && (
        <Modal title="Silme Onayı" onClose={() => setDeletingItem(undefined)}>
          <p className="text-sm mb-4">
            <strong>{deletingItem.name}</strong> switch'ini silmek istediğinize emin misiniz? Bu switch'e bağlı
            topoloji bağlantıları da silinecek.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeletingItem(undefined)}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
            >
              Vazgeç
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90"
            >
              Sil
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
