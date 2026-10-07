import { Fragment, useEffect, useMemo, useState } from "react";
import { createSubnet, deleteSubnet, getSubnetPool, listSubnets, updateSubnet } from "../../api/subnets";
import {
  createIpAssignment,
  deleteIpAssignment,
  listIpAssignments,
  updateIpAssignment
} from "../../api/ipAssignments";
import { listInventory } from "../../api/inventory";
import type {
  InventoryItem,
  IpAssignment,
  IpAssignmentFormData,
  IpAssignmentStatus,
  Subnet,
  SubnetFormData,
  SubnetPool
} from "../../types";
import Modal from "../../components/Modal";
import IpStatusBadge from "../../components/IpStatusBadge";
import SubnetForm from "./SubnetForm";
import IpAssignmentForm from "./IpAssignmentForm";

const STATUS_FILTERS: { value: IpAssignmentStatus | ""; label: string }[] = [
  { value: "", label: "Tüm Durumlar" },
  { value: "kullanimda", label: "Kullanımda" },
  { value: "bos", label: "Boş" },
  { value: "rezerve", label: "Rezerve" }
];

export default function NetworkPage() {
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [assignments, setAssignments] = useState<IpAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [subnetFilter, setSubnetFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<IpAssignmentStatus | "">("");

  const [subnetModalOpen, setSubnetModalOpen] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | undefined>(undefined);
  const [deletingSubnet, setDeletingSubnet] = useState<Subnet | undefined>(undefined);

  const [pools, setPools] = useState<Record<string, SubnetPool>>({});
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  const [ipModalOpen, setIpModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<IpAssignment | undefined>(undefined);
  const [deletingAssignment, setDeletingAssignment] = useState<IpAssignment | undefined>(undefined);

  async function loadSubnets() {
    const data = await listSubnets();
    setSubnets(data);
    await loadPools(data);
  }

  async function loadPools(subnetList: Subnet[]) {
    const entries = await Promise.all(
      subnetList.map(async (s) => {
        try {
          return [s.id, await getSubnetPool(s.id)] as const;
        } catch {
          return [s.id, { valid: false, cidr: s.cidr } as SubnetPool] as const;
        }
      })
    );
    setPools(Object.fromEntries(entries));
  }

  async function loadInventory() {
    const data = await listInventory({});
    setInventory(data);
  }

  async function loadAssignments() {
    setLoadingAssignments(true);
    setError(null);
    try {
      const data = await listIpAssignments({ q, subnet_id: subnetFilter, status: statusFilter });
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoadingAssignments(false);
    }
  }

  useEffect(() => {
    loadSubnets();
    loadInventory();
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadAssignments, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, subnetFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = assignments.length;
    const used = assignments.filter((a) => a.status === "kullanimda").length;
    const free = assignments.filter((a) => a.status === "bos").length;
    const reserved = assignments.filter((a) => a.status === "rezerve").length;
    return { total, used, free, reserved };
  }, [assignments]);

  function openCreateSubnet() {
    setEditingSubnet(undefined);
    setSubnetModalOpen(true);
  }

  function openEditSubnet(s: Subnet) {
    setEditingSubnet(s);
    setSubnetModalOpen(true);
  }

  async function handleSubnetSubmit(data: SubnetFormData) {
    if (editingSubnet) {
      await updateSubnet(editingSubnet.id, data);
    } else {
      await createSubnet(data);
    }
    setSubnetModalOpen(false);
    await loadSubnets();
  }

  async function handleSubnetDelete() {
    if (!deletingSubnet) return;
    await deleteSubnet(deletingSubnet.id);
    setDeletingSubnet(undefined);
    await loadSubnets();
    await loadAssignments();
  }

  function openCreateAssignment() {
    setEditingAssignment(undefined);
    setIpModalOpen(true);
  }

  function openEditAssignment(a: IpAssignment) {
    setEditingAssignment(a);
    setIpModalOpen(true);
  }

  async function handleAssignmentSubmit(data: IpAssignmentFormData) {
    if (editingAssignment) {
      await updateIpAssignment(editingAssignment.id, data);
    } else {
      await createIpAssignment(data);
    }
    setIpModalOpen(false);
    await loadAssignments();
    await loadPools(subnets);
  }

  async function handleAssignmentDelete() {
    if (!deletingAssignment) return;
    await deleteIpAssignment(deletingAssignment.id);
    setDeletingAssignment(undefined);
    await loadAssignments();
    await loadPools(subnets);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">IP / Ağ Planı</h2>
        <p className="text-sm text-secondary">
          Subnet/VLAN tanımları ve IP-cihaz eşleştirmeleri.
        </p>
      </div>

      {/* Subnet listesi */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Subnet / VLAN Listesi</h3>
          <button
            onClick={openCreateSubnet}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
          >
            + Yeni Subnet
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-secondary">
                <th className="px-3 py-2 font-medium">Ad</th>
                <th className="px-3 py-2 font-medium">CIDR</th>
                <th className="px-3 py-2 font-medium">VLAN</th>
                <th className="px-3 py-2 font-medium">Açıklama</th>
                <th className="px-3 py-2 font-medium">Kullanım</th>
                <th className="px-3 py-2 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {subnets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-tertiary">
                    Kayıt bulunamadı
                  </td>
                </tr>
              )}
              {subnets.map((s) => {
                const pool = pools[s.id];
                const isExpanded = expandedPoolId === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr className="border-b last:border-0 hover:bg-surface-secondary transition-colors duration-150">
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.cidr}</td>
                      <td className="px-3 py-2">{s.vlan_id ?? "—"}</td>
                      <td className="px-3 py-2">{s.description || "—"}</td>
                      <td className="px-3 py-2">
                        {!pool && <span className="text-tertiary">Hesaplanıyor...</span>}
                        {pool && !pool.valid && (
                          <span className="text-danger text-xs">Geçersiz CIDR</span>
                        )}
                        {pool && pool.valid && (
                          <button
                            onClick={() => setExpandedPoolId(isExpanded ? null : s.id)}
                            className="text-left hover:underline"
                          >
                            <span className="text-xs">
                              {pool.totalUsable} adresten <strong>{pool.used}</strong> dolu,{" "}
                              <strong>{pool.free}</strong> boş (%{pool.percentUsed})
                            </span>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button onClick={() => openEditSubnet(s)} className="text-accent hover:underline">
                          Düzenle
                        </button>
                        <button
                          onClick={() => setDeletingSubnet(s)}
                          className="text-danger hover:underline"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                    {isExpanded && pool && pool.valid && (
                      <tr className="border-b last:border-0 bg-surface-secondary/60">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="text-xs space-y-2">
                            <p className="text-secondary">
                              Ağ: {pool.networkAddress} · Broadcast: {pool.broadcastAddress}
                              {pool.isLarge && " · Büyük subnet — tüm liste değil, sadece sayı hesaplandı"}
                            </p>
                            {pool.nextFree && (
                              <p>
                                Sıradaki boş IP:{" "}
                                <strong className="text-success">
                                  {pool.nextFree}
                                </strong>
                              </p>
                            )}
                            {pool.freeSample.length > 0 ? (
                              <div>
                                <p className="text-secondary mb-1">
                                  Boş IP'ler (ilk {pool.freeSample.length}
                                  {pool.sampleTruncated ? "+, taranan aralık sınırlı" : ""}):
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {pool.freeSample.map((ip) => (
                                    <span
                                      key={ip}
                                      className="px-2 py-0.5 rounded-full bg-success-soft text-success"
                                    >
                                      {ip}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-tertiary">Boş IP bulunamadı — subnet dolu.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* IP eşleştirme */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">IP - Cihaz Eşleştirme</h3>
          <button
            onClick={openCreateAssignment}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
          >
            + Yeni Eşleştirme
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-3 text-xs">
          <span className="px-2 py-1 rounded-md bg-surface-secondary">
            Toplam: <strong>{summary.total}</strong>
          </span>
          <span className="px-2 py-1 rounded-md bg-success-soft text-success">
            Kullanımda: <strong>{summary.used}</strong>
          </span>
          <span className="px-2 py-1 rounded-md bg-surface-secondary text-secondary">
            Boş: <strong>{summary.free}</strong>
          </span>
          <span className="px-2 py-1 rounded-md bg-warning-soft text-warning">
            Rezerve: <strong>{summary.reserved}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <input
            placeholder="Ara: IP, cihaz adı, not..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[220px] rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
          />
          <select
            value={subnetFilter}
            onChange={(e) => setSubnetFilter(e.target.value)}
            className="rounded-md border bg-surface px-3 py-1.5 text-sm"
          >
            <option value="">Tüm Subnetler</option>
            {subnets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.cidr})
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IpAssignmentStatus | "")}
            className="rounded-md border bg-surface px-3 py-1.5 text-sm"
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-danger mb-3">{error}</p>}

        <div className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-secondary">
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">Subnet</th>
                <th className="px-3 py-2 font-medium">Cihaz Adı</th>
                <th className="px-3 py-2 font-medium">Envanter</th>
                <th className="px-3 py-2 font-medium">Durum</th>
                <th className="px-3 py-2 font-medium">Not</th>
                <th className="px-3 py-2 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loadingAssignments && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-tertiary">
                    Yükleniyor...
                  </td>
                </tr>
              )}
              {!loadingAssignments && assignments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-tertiary">
                    Kayıt bulunamadı
                  </td>
                </tr>
              )}
              {!loadingAssignments &&
                assignments.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-surface-secondary transition-colors duration-150">
                    <td className="px-3 py-2 font-medium">{a.ip_address}</td>
                    <td className="px-3 py-2">{a.subnet_name || "—"}</td>
                    <td className="px-3 py-2">{a.device_name || "—"}</td>
                    <td className="px-3 py-2">{a.inventory_name || "—"}</td>
                    <td className="px-3 py-2">
                      <IpStatusBadge status={a.status} />
                    </td>
                    <td className="px-3 py-2">{a.notes || "—"}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => openEditAssignment(a)}
                        className="text-accent hover:underline"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => setDeletingAssignment(a)}
                        className="text-danger hover:underline"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {subnetModalOpen && (
        <Modal title={editingSubnet ? "Subnet Düzenle" : "Yeni Subnet"} onClose={() => setSubnetModalOpen(false)}>
          <SubnetForm item={editingSubnet} onSubmit={handleSubnetSubmit} onCancel={() => setSubnetModalOpen(false)} />
        </Modal>
      )}

      {deletingSubnet && (
        <Modal title="Silme Onayı" onClose={() => setDeletingSubnet(undefined)}>
          <p className="text-sm mb-4">
            <strong>{deletingSubnet.name}</strong> subnet'ini silmek istediğinize emin misiniz? Bu subnet'e bağlı
            IP eşleştirmeleri de silinecek.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeletingSubnet(undefined)}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSubnetDelete}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90"
            >
              Sil
            </button>
          </div>
        </Modal>
      )}

      {ipModalOpen && (
        <Modal
          title={editingAssignment ? "Eşleştirmeyi Düzenle" : "Yeni Eşleştirme"}
          onClose={() => setIpModalOpen(false)}
        >
          <IpAssignmentForm
            item={editingAssignment}
            subnets={subnets}
            inventory={inventory}
            defaultSubnetId={subnetFilter || undefined}
            onSubmit={handleAssignmentSubmit}
            onCancel={() => setIpModalOpen(false)}
          />
        </Modal>
      )}

      {deletingAssignment && (
        <Modal title="Silme Onayı" onClose={() => setDeletingAssignment(undefined)}>
          <p className="text-sm mb-4">
            <strong>{deletingAssignment.ip_address}</strong> eşleştirmesini silmek istediğinize emin misiniz?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeletingAssignment(undefined)}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
            >
              Vazgeç
            </button>
            <button
              onClick={handleAssignmentDelete}
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
