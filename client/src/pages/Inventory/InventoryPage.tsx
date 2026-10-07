import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  bulkDeleteInventoryItems,
  bulkUpdateInventoryStatus,
  createInventoryItem,
  deleteInventoryItem,
  exportInventoryCsvUrl,
  listInventory,
  updateInventoryItem
} from "../../api/inventory";
import type { InventoryFormData, InventoryItem, InventoryStatus } from "../../types";
import Modal from "../../components/Modal";
import StatusBadge from "../../components/StatusBadge";
import WarrantyBadge from "../../components/WarrantyBadge";
import InventoryForm from "./InventoryForm";

const STATUS_FILTERS: { value: InventoryStatus | ""; label: string }[] = [
  { value: "", label: "Tüm Durumlar" },
  { value: "aktif", label: "Aktif" },
  { value: "arizali", label: "Arızalı" },
  { value: "yedek", label: "Yedek" },
  { value: "hurda", label: "Hurda" }
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const initialStatus = (searchParams.get("status") as InventoryStatus | null) ?? "";
  const initialQ = searchParams.get("q") ?? "";

  const [q, setQ] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "">(initialStatus);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | undefined>(undefined);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<InventoryStatus>("aktif");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listInventory({ q, type: typeFilter, status: statusFilter });
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
  }, [q, typeFilter, statusFilter]);

  // Filtre değişince seçim geçersizleşebilir (görünmeyen kayıtlar seçili
  // kalmasın) — güvenli tarafta kalmak için filtre değişince seçim temizlenir.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [q, typeFilter, statusFilter]);

  const allVisibleSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someVisibleSelected = items.some((i) => selectedIds.has(i.id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  async function handleBulkStatus() {
    setBulkError(null);
    setBulkBusy(true);
    try {
      await bulkUpdateInventoryStatus(Array.from(selectedIds), bulkStatusValue);
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Toplu güncelleme başarısız oldu");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDelete() {
    setBulkError(null);
    setBulkBusy(true);
    try {
      await bulkDeleteInventoryItems(Array.from(selectedIds));
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Toplu silme başarısız oldu");
      setBulkDeleteConfirm(false);
    } finally {
      setBulkBusy(false);
    }
  }

  const types = useMemo(() => {
    const set = new Set(items.map((i) => i.type).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  function openCreate() {
    setEditingItem(undefined);
    setModalOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditingItem(item);
    setModalOpen(true);
  }

  async function handleSubmit(data: InventoryFormData) {
    if (editingItem) {
      await updateInventoryItem(editingItem.id, data);
    } else {
      await createInventoryItem(data);
    }
    setModalOpen(false);
    await load();
  }

  async function handleDelete() {
    if (!deletingItem) return;
    await deleteInventoryItem(deletingItem.id);
    setDeletingItem(undefined);
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Envanter</h2>
        <div className="flex gap-2">
          <a
            href={exportInventoryCsvUrl()}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
          >
            CSV İndir
          </a>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
          >
            + Yeni Cihaz
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="Ara: ad, marka, seri no, IP, konum..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[220px] rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">Tüm Türler</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InventoryStatus | "")}
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
      {bulkError && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2 mb-3">{bulkError}</p>}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 rounded-md border bg-accent-soft">
          <span className="text-sm font-medium text-primary">{selectedIds.size} kayıt seçili</span>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={bulkStatusValue}
              onChange={(e) => setBulkStatusValue(e.target.value as InventoryStatus)}
              className="rounded-md border bg-surface px-2 py-1.5 text-sm"
            >
              <option value="aktif">Aktif</option>
              <option value="arizali">Arızalı</option>
              <option value="yedek">Yedek</option>
              <option value="hurda">Hurda</option>
            </select>
            <button
              onClick={handleBulkStatus}
              disabled={bulkBusy}
              className="px-3 py-1.5 text-sm rounded-md border bg-surface hover:bg-surface-secondary disabled:opacity-50"
            >
              Durumu Uygula
            </button>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              disabled={bulkBusy}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90 disabled:opacity-50"
            >
              Sil
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkBusy}
              className="text-xs text-tertiary hover:text-primary disabled:opacity-50"
            >
              Seçimi Temizle
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-secondary">
              <th className="px-3 py-2 w-8">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  aria-label="Tümünü seç"
                />
              </th>
              <th className="px-3 py-2 font-medium">Ad</th>
              <th className="px-3 py-2 font-medium">Tür</th>
              <th className="px-3 py-2 font-medium">Marka/Model</th>
              <th className="px-3 py-2 font-medium">IP</th>
              <th className="px-3 py-2 font-medium">Konum</th>
              <th className="px-3 py-2 font-medium">Durum</th>
              <th className="px-3 py-2 font-medium">Garanti</th>
              <th className="px-3 py-2 font-medium text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-tertiary">
                  Yükleniyor...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-tertiary">
                  Kayıt bulunamadı
                </td>
              </tr>
            )}
            {!loading &&
              items.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b last:border-0 hover:bg-surface-secondary transition-colors duration-150 ${
                    selectedIds.has(item.id) ? "bg-accent-soft/40" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`${item.name} seç`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2">{item.type}</td>
                  <td className="px-3 py-2">{item.brand_model || "—"}</td>
                  <td className="px-3 py-2">{item.ip_address || "—"}</td>
                  <td className="px-3 py-2">{item.location || "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2">
                    {item.warranty_until ? (
                      <span className="inline-flex items-center gap-1.5">
                        {item.warranty_until}
                        <WarrantyBadge warrantyUntil={item.warranty_until} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => openEdit(item)}
                      className="text-accent hover:underline"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => setDeletingItem(item)}
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

      {modalOpen && (
        <Modal title={editingItem ? "Cihazı Düzenle" : "Yeni Cihaz"} onClose={() => setModalOpen(false)}>
          <InventoryForm item={editingItem} onSubmit={handleSubmit} onCancel={() => setModalOpen(false)} />
        </Modal>
      )}

      {deletingItem && (
        <Modal title="Silme Onayı" onClose={() => setDeletingItem(undefined)}>
          <p className="text-sm mb-4">
            <strong>{deletingItem.name}</strong> kaydını silmek istediğinize emin misiniz?
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

      {bulkDeleteConfirm && (
        <Modal title="Toplu Silme Onayı" onClose={() => setBulkDeleteConfirm(false)}>
          <p className="text-sm mb-4">
            <strong>{selectedIds.size}</strong> kayıt silinecek. Bu işlem geri alınamaz, emin misiniz?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setBulkDeleteConfirm(false)}
              disabled={bulkBusy}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkBusy}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90 disabled:opacity-50"
            >
              {bulkBusy ? "Siliniyor..." : `Evet, ${selectedIds.size} Kaydı Sil`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
