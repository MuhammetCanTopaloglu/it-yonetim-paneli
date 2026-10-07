import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createLicense, deleteLicense, listLicenses, updateLicense } from "../../api/licenses";
import type { License, LicenseFormData } from "../../types";
import Modal from "../../components/Modal";
import LicenseRenewalBadge from "../../components/LicenseRenewalBadge";
import { formatRenewalDate } from "../../lib/licenseRenewal";
import LicenseForm from "./LicenseForm";
import LicenseSeatPanel from "./LicenseSeatPanel";

function formatCost(cost: number | null, currency: string): string {
  if (cost == null) return "—";
  return `${cost.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Kasadaki tek-satır deseninin aynısı: aynı anda sadece TEK lisansın
  // anahtarı açık kalabilir — biri açılınca öncekini otomatik kapatır. State
  // burada (liste seviyesinde) tutulur ki bir satırı kapatıp başka satır
  // açtığında eskisi kesinlikle gizlensin.
  const [revealedKeyLicenseId, setRevealedKeyLicenseId] = useState<string | null>(null);
  const [revealedKeyValue, setRevealedKeyValue] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | undefined>(undefined);
  const [deletingLicense, setDeletingLicense] = useState<License | undefined>(undefined);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setLicenses(await listLicenses());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = licenses.filter((l) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return l.product_name.toLowerCase().includes(needle) || (l.vendor ?? "").toLowerCase().includes(needle);
  });

  function openCreate() {
    setEditingLicense(undefined);
    setModalOpen(true);
  }

  function openEdit(license: License) {
    setEditingLicense(license);
    setModalOpen(true);
  }

  async function handleSubmit(data: LicenseFormData) {
    if (editingLicense) {
      await updateLicense(editingLicense.id, data);
    } else {
      await createLicense(data);
    }
    setModalOpen(false);
    setEditingLicense(undefined);
    await load();
  }

  async function handleDelete() {
    if (!deletingLicense) return;
    try {
      await deleteLicense(deletingLicense.id);
      if (expandedId === deletingLicense.id) setExpandedId(null);
      if (revealedKeyLicenseId === deletingLicense.id) {
        setRevealedKeyLicenseId(null);
        setRevealedKeyValue(null);
      }
      setDeletingLicense(undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silinemedi");
      setDeletingLicense(undefined);
    }
  }

  function toggleExpanded(licenseId: string) {
    const closing = expandedId === licenseId;
    setExpandedId(closing ? null : licenseId);
    // Satır kapanınca (veya başka bir lisansın satırı açılınca) o lisansın
    // açık anahtarı da bellekten temizlenir — görünmeyen bir panelde çözülmüş
    // anahtar bekletilmesin.
    if (closing && revealedKeyLicenseId === licenseId) {
      setRevealedKeyLicenseId(null);
      setRevealedKeyValue(null);
    }
  }

  function handleKeyRevealed(licenseId: string, key: string) {
    setRevealedKeyLicenseId(licenseId);
    setRevealedKeyValue(key);
  }

  function handleKeyHidden() {
    setRevealedKeyLicenseId(null);
    setRevealedKeyValue(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Lisanslar</h2>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
        >
          + Yeni Lisans
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="Ara: ürün, tedarikçi..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[220px] rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      <div className="overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-secondary">
              <th className="px-3 py-2 font-medium">Ürün</th>
              <th className="px-3 py-2 font-medium">Tedarikçi</th>
              <th className="px-3 py-2 font-medium">Koltuk</th>
              <th className="px-3 py-2 font-medium">Yenileme</th>
              <th className="px-3 py-2 font-medium">Maliyet</th>
              <th className="px-3 py-2 font-medium text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-tertiary">
                  Yükleniyor...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-tertiary">
                  Kayıt bulunamadı
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((license) => {
                const isExpanded = expandedId === license.id;
                const free = license.total_seats - license.used_seats;
                return (
                  <Fragment key={license.id}>
                    <tr className="border-b last:border-0 hover:bg-surface-secondary transition-colors duration-150">
                      <td className="px-3 py-2 font-medium">{license.product_name}</td>
                      <td className="px-3 py-2">{license.vendor || "—"}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => toggleExpanded(license.id)} className="text-left hover:underline">
                          <span className="text-xs">
                            <strong>{license.used_seats}</strong>/{license.total_seats} kullanılıyor,{" "}
                            <strong>{free}</strong> boş
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {license.renewal_date ? (
                          <span className="inline-flex items-center gap-1.5">
                            {formatRenewalDate(license.renewal_date)}
                            <LicenseRenewalBadge renewalDate={license.renewal_date} />
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">{formatCost(license.cost, license.currency)}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button onClick={() => toggleExpanded(license.id)} className="text-accent hover:underline">
                          {isExpanded ? "Gizle" : "Koltuklar"}
                        </button>
                        <button onClick={() => openEdit(license)} className="text-accent hover:underline">
                          Düzenle
                        </button>
                        <button onClick={() => setDeletingLicense(license)} className="text-danger hover:underline">
                          Sil
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b last:border-0 bg-surface-secondary/60">
                        <td colSpan={6} className="px-3 py-3">
                          <LicenseSeatPanel
                            license={license}
                            onChanged={load}
                            revealedKey={revealedKeyLicenseId === license.id ? revealedKeyValue : null}
                            onKeyRevealed={(key) => handleKeyRevealed(license.id, key)}
                            onKeyHidden={handleKeyHidden}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal
          title={editingLicense ? "Lisansı Düzenle" : "Yeni Lisans"}
          onClose={() => {
            setModalOpen(false);
            setEditingLicense(undefined);
          }}
        >
          <LicenseForm
            license={editingLicense}
            onSubmit={handleSubmit}
            onCancel={() => {
              setModalOpen(false);
              setEditingLicense(undefined);
            }}
          />
        </Modal>
      )}

      {deletingLicense && (
        <Modal title="Silme Onayı" onClose={() => setDeletingLicense(undefined)}>
          <p className="text-sm mb-4">
            <strong>{deletingLicense.product_name}</strong> lisansını silmek istediğinize emin misiniz? Bu lisansa
            bağlı tüm koltuk atamaları da silinecek. Bu işlem geri alınamaz.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeletingLicense(undefined)}
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
