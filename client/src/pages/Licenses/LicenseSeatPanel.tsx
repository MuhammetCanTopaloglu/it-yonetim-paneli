import { useEffect, useState, type FormEvent } from "react";
import { listSwitches } from "../../api/switches";
import { listInventory } from "../../api/inventory";
import {
  createLicenseAssignment,
  deleteLicenseAssignment,
  listLicenseAssignments,
  revealLicenseKey
} from "../../api/licenses";
import { VaultLockedError } from "../../api/vault";
import { useToast } from "../../components/Toast";
import VaultUnlockInline from "../../components/VaultUnlockInline";
import type {
  InventoryItem,
  License,
  LicenseAssignment,
  LicenseAssignmentTargetType,
  Switch
} from "../../types";

const fieldClass = "w-full rounded-md border bg-surface px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-accent";

const TARGET_LABELS: Record<LicenseAssignmentTargetType, string> = {
  inventory: "Envanter",
  switch: "Switch",
  other: "Serbest"
};

/**
 * Genişleyen satır içeriği: lisans anahtarı göster/gizle + koltuk (kullanan)
 * listesi + yeni atama formu. Çözülmüş anahtar SADECE üst bileşenin
 * (LicensesPage) React state'inde tutulur — localStorage/sessionStorage'a
 * hiç yazılmaz. Anahtar reveal/hide state'i bilerek burada değil, listede
 * tutuluyor: kasadaki "aynı anda tek satır açık" kısıtının aynısı — bir
 * lisansın anahtarını açmak başka bir lisansınkini otomatik kapatır.
 */
export default function LicenseSeatPanel({
  license,
  onChanged,
  revealedKey,
  onKeyRevealed,
  onKeyHidden
}: {
  license: License;
  onChanged: () => void;
  revealedKey: string | null;
  onKeyRevealed: (key: string) => void;
  onKeyHidden: () => void;
}) {
  const { showToast } = useToast();

  const [assignments, setAssignments] = useState<LicenseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [targetType, setTargetType] = useState<LicenseAssignmentTargetType>("other");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [assignedLabel, setAssignedLabel] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [keyVaultLocked, setKeyVaultLocked] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setAssignments(await listLicenseAssignments(license.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    listSwitches().then(setSwitches).catch(() => {});
    listInventory({}).then(setInventory).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [license.id]);

  function handleTargetTypeChange(next: LicenseAssignmentTargetType) {
    setTargetType(next);
    setTargetId(null);
    if (next === "other") setAssignedLabel("");
  }

  function handleTargetIdChange(id: string) {
    setTargetId(id || null);
    if (!id) return;
    const found =
      targetType === "switch" ? switches.find((s) => s.id === id)?.name : inventory.find((i) => i.id === id)?.name;
    if (found) setAssignedLabel(found);
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    setAssignError(null);
    if (!assignedLabel.trim()) {
      setAssignError("Etiket zorunludur");
      return;
    }
    setAssigning(true);
    try {
      await createLicenseAssignment(license.id, {
        target_type: targetType,
        target_id: targetType === "other" ? null : targetId,
        assigned_label: assignedLabel.trim()
      });
      setAssignedLabel("");
      setTargetId(null);
      setTargetType("other");
      await load();
      onChanged();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Atanamadı");
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove(assignmentId: string) {
    try {
      await deleteLicenseAssignment(license.id, assignmentId);
      await load();
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Kaldırılamadı", "danger");
    }
  }

  async function handleReveal() {
    setRevealError(null);
    setKeyVaultLocked(false);
    setRevealLoading(true);
    try {
      const data = await revealLicenseKey(license.id);
      onKeyRevealed(data.license_key);
    } catch (err) {
      if (err instanceof VaultLockedError) setKeyVaultLocked(true);
      else setRevealError(err instanceof Error ? err.message : "Çözülemedi");
    } finally {
      setRevealLoading(false);
    }
  }

  async function handleVaultUnlocked() {
    setKeyVaultLocked(false);
    // Kasa şimdi açıldı — kullanıcı ikinci kez "Göster"e basmak zorunda
    // kalmasın diye anahtarı otomatik tekrar dener.
    await handleReveal();
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Lisans anahtarı panoya kopyalandı", "success");
    } catch {
      showToast("Panoya kopyalanamadı", "danger");
    }
  }

  const seatsFull = assignments.length >= license.total_seats;

  return (
    <div className="text-xs space-y-4">
      <div>
        <p className="text-secondary mb-1 font-medium">Lisans Anahtarı</p>
        {!license.has_key && <p className="text-tertiary">Bu lisans için anahtar girilmemiş.</p>}
        {license.has_key && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-primary">{revealedKey ?? "••••••••••••"}</span>
            {!revealedKey && (
              <button
                onClick={handleReveal}
                disabled={revealLoading}
                className="text-accent hover:underline disabled:opacity-50"
              >
                {revealLoading ? "Çözülüyor..." : "Göster"}
              </button>
            )}
            {revealedKey && (
              <>
                <button onClick={() => handleCopy(revealedKey)} className="text-accent hover:underline">
                  Kopyala
                </button>
                <button onClick={onKeyHidden} className="text-tertiary hover:underline">
                  Gizle
                </button>
              </>
            )}
          </div>
        )}
        {revealError && <p className="text-danger mt-1">{revealError}</p>}
        {keyVaultLocked && (
          <div className="mt-1.5 max-w-xs">
            <VaultUnlockInline onUnlocked={handleVaultUnlocked} />
          </div>
        )}
      </div>

      <div>
        <p className="text-secondary mb-1 font-medium">
          Kullanan ({assignments.length}/{license.total_seats})
        </p>
        {loading && <p className="text-tertiary">Yükleniyor...</p>}
        {error && <p className="text-danger">{error}</p>}
        {!loading && assignments.length === 0 && <p className="text-tertiary">Henüz kimseye atanmamış.</p>}
        {!loading && assignments.length > 0 && (
          <ul className="space-y-1">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-surface-secondary/60"
              >
                <span>
                  {a.assigned_label} <span className="text-tertiary">({TARGET_LABELS[a.target_type]})</span>
                </span>
                <button onClick={() => handleRemove(a.id)} className="text-danger hover:underline">
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-secondary mb-1 font-medium">Koltuk Ata</p>
        {seatsFull ? (
          <p className="text-warning bg-warning-soft rounded-md px-2 py-1.5 inline-block">
            Tüm koltuklar dolu ({assignments.length}/{license.total_seats}).
          </p>
        ) : (
          <form onSubmit={handleAssign} className="space-y-2 max-w-sm">
            {assignError && <p className="text-danger">{assignError}</p>}

            <select
              value={targetType}
              onChange={(e) => handleTargetTypeChange(e.target.value as LicenseAssignmentTargetType)}
              className={fieldClass}
            >
              <option value="other">Serbest etiket (kişi/departman)</option>
              <option value="switch">Switch</option>
              <option value="inventory">Envanter</option>
            </select>

            {targetType === "switch" && (
              <select value={targetId ?? ""} onChange={(e) => handleTargetIdChange(e.target.value)} className={fieldClass}>
                <option value="">— seçin —</option>
                {switches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {targetType === "inventory" && (
              <select value={targetId ?? ""} onChange={(e) => handleTargetIdChange(e.target.value)} className={fieldClass}>
                <option value="">— seçin —</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            )}

            <input
              value={assignedLabel}
              onChange={(e) => setAssignedLabel(e.target.value)}
              placeholder="Etiket (ör. Ahmet Yılmaz)"
              className={fieldClass}
            />

            <button
              type="submit"
              disabled={assigning}
              className="px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {assigning ? "Atanıyor..." : "Ata"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
