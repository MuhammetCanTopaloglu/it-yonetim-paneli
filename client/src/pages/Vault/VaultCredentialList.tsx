import { useEffect, useState } from "react";
import {
  createVaultCredential,
  deleteVaultCredential,
  listVaultCredentials,
  lockVault,
  revealVaultCredential,
  updateVaultCredential,
  VaultLockedError
} from "../../api/vault";
import { listSwitches } from "../../api/switches";
import { listInventory } from "../../api/inventory";
import type {
  InventoryItem,
  RevealedVaultCredential,
  Switch,
  VaultCredentialInput,
  VaultCredentialSummary
} from "../../types";
import Modal from "../../components/Modal";
import { useToast } from "../../components/Toast";
import VaultCredentialForm from "./VaultCredentialForm";
import VaultChangeMasterPasswordForm from "./VaultChangeMasterPasswordForm";

/**
 * Kasa açıkken gösterilen ana ekran. GÜVENLİK: çözülmüş kullanıcı adı/şifre
 * ASLA localStorage/sessionStorage'a yazılmaz — sadece bu bileşenin React
 * state'inde (`revealed`) tutulur, başka bir satır açılınca veya bileşen
 * unmount olunca (sayfadan çıkış) kaybolur. Aynı anda sadece TEK satır açık
 * kalabilir — yeni bir satır açmak öncekini otomatik kapatır.
 */
export default function VaultCredentialList({ onLocked }: { onLocked: () => void }) {
  const [items, setItems] = useState<VaultCredentialSummary[]>([]);
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedVaultCredential | null>(null);
  const [revealLoadingId, setRevealLoadingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ summary: VaultCredentialSummary; revealed: RevealedVaultCredential } | null>(
    null
  );
  const [deletingItem, setDeletingItem] = useState<VaultCredentialSummary | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [creds, sw, inv] = await Promise.all([listVaultCredentials(), listSwitches(), listInventory({})]);
      setItems(creds);
      setSwitches(sw);
      setInventory(inv);
    } catch (err) {
      if (err instanceof VaultLockedError) return onLocked();
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function targetLabel(item: VaultCredentialSummary): string {
    if (item.target_type === "switch") {
      const s = switches.find((x) => x.id === item.target_id);
      return s ? `Switch: ${s.name}` : item.target_id ? "Switch (silinmiş)" : "Switch";
    }
    if (item.target_type === "inventory") {
      const i = inventory.find((x) => x.id === item.target_id);
      return i ? `Envanter: ${i.name}` : item.target_id ? "Envanter (silinmiş)" : "Envanter";
    }
    return "Serbest etiket";
  }

  async function handleToggleReveal(item: VaultCredentialSummary) {
    if (revealedId === item.id) {
      setRevealedId(null);
      setRevealed(null);
      return;
    }
    setRevealLoadingId(item.id);
    try {
      const data = await revealVaultCredential(item.id);
      setRevealedId(item.id);
      setRevealed(data);
    } catch (err) {
      if (err instanceof VaultLockedError) return onLocked();
      showToast(err instanceof Error ? err.message : "Çözülemedi", "danger");
    } finally {
      setRevealLoadingId(null);
    }
  }

  async function handleCopy(value: string, what: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${what} panoya kopyalandı`, "success");
    } catch {
      showToast("Panoya kopyalanamadı", "danger");
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  async function openEdit(item: VaultCredentialSummary) {
    try {
      const data = await revealVaultCredential(item.id);
      setEditing({ summary: item, revealed: data });
      setFormOpen(true);
    } catch (err) {
      if (err instanceof VaultLockedError) return onLocked();
      showToast(err instanceof Error ? err.message : "Çözülemedi", "danger");
    }
  }

  async function handleSubmit(data: VaultCredentialInput) {
    if (editing) {
      await updateVaultCredential(editing.summary.id, data);
    } else {
      await createVaultCredential(data);
    }
    setFormOpen(false);
    setEditing(null);
    setRevealedId(null);
    setRevealed(null);
    await load();
  }

  async function handleDelete() {
    if (!deletingItem) return;
    try {
      await deleteVaultCredential(deletingItem.id);
      if (revealedId === deletingItem.id) {
        setRevealedId(null);
        setRevealed(null);
      }
      setDeletingItem(null);
      await load();
    } catch (err) {
      if (err instanceof VaultLockedError) return onLocked();
      showToast(err instanceof Error ? err.message : "Silinemedi", "danger");
    }
  }

  async function handleLock() {
    await lockVault().catch(() => {});
    setRevealedId(null);
    setRevealed(null);
    onLocked();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-primary">🔒 Kasa</h2>
          <p className="text-xs text-tertiary">Kimlik bilgileri kasası açık.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChangePasswordOpen(true)}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
          >
            Ana Parolayı Değiştir
          </button>
          <button
            onClick={handleLock}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
          >
            Kasayı Kilitle
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
          >
            + Yeni Kayıt
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      {loading && <p className="text-sm text-tertiary">Yükleniyor...</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-tertiary">Henüz kayıt yok. "+ Yeni Kayıt" ile ekleyin.</p>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const isRevealed = revealedId === item.id;
          const isRevealLoading = revealLoadingId === item.id;
          return (
            <div key={item.id} className="rounded-lg border bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">{item.label}</p>
                  <p className="text-xs text-tertiary">{targetLabel(item)}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs shrink-0">
                  <button onClick={() => openEdit(item)} className="text-accent hover:underline px-1">
                    Düzenle
                  </button>
                  <button
                    onClick={() => setDeletingItem(item)}
                    className="text-danger hover:underline px-1"
                  >
                    Sil
                  </button>
                </div>
              </div>

              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-tertiary text-xs w-20 shrink-0">Kullanıcı adı</span>
                  <span className="font-mono text-primary truncate">
                    {isRevealed ? revealed?.username : "••••••••"}
                  </span>
                  {isRevealed && (
                    <button
                      onClick={() => handleCopy(revealed!.username, "Kullanıcı adı")}
                      className="text-xs text-accent hover:underline shrink-0"
                    >
                      Kopyala
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-tertiary text-xs w-20 shrink-0">Şifre</span>
                  <span className="font-mono text-primary truncate">
                    {isRevealed ? revealed?.password : "••••••••"}
                  </span>
                  {isRevealed && (
                    <button
                      onClick={() => handleCopy(revealed!.password, "Şifre")}
                      className="text-xs text-accent hover:underline shrink-0"
                    >
                      Kopyala
                    </button>
                  )}
                </div>
                {isRevealed && revealed?.notes && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-tertiary text-xs w-20 shrink-0">Not</span>
                    <span className="text-secondary whitespace-pre-wrap">{revealed.notes}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleToggleReveal(item)}
                disabled={isRevealLoading}
                className="mt-2.5 text-xs px-2.5 py-1 rounded-md border hover:bg-surface-secondary disabled:opacity-50"
              >
                {isRevealLoading ? "Çözülüyor..." : isRevealed ? "Gizle" : "Göster"}
              </button>
            </div>
          );
        })}
      </div>

      {formOpen && (
        <Modal
          title={editing ? "Kaydı Düzenle" : "Yeni Kayıt"}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        >
          <VaultCredentialForm
            editing={editing ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {deletingItem && (
        <Modal title="Silme Onayı" onClose={() => setDeletingItem(null)}>
          <p className="text-sm mb-4">
            <strong>{deletingItem.label}</strong> kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeletingItem(null)}
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

      {changePasswordOpen && <VaultChangeMasterPasswordForm onClose={() => setChangePasswordOpen(false)} />}
    </div>
  );
}
