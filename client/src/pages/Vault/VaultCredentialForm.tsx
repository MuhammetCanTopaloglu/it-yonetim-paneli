import { useEffect, useState, type FormEvent } from "react";
import { listSwitches } from "../../api/switches";
import { listInventory } from "../../api/inventory";
import type { RevealedVaultCredential, Switch, InventoryItem, VaultCredentialInput, VaultCredentialSummary, VaultCredentialTargetType } from "../../types";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

/**
 * Yeni kayıt VEYA düzenleme (editing/revealed birlikte verilirse düzenleme —
 * mevcut kullanıcı adı/şifre/not alanları REVEAL edilmiş haliyle önceden
 * doldurulur, kullanıcı isterse değiştirir; backend her durumda taze IV ile
 * yeniden şifreler).
 */
export default function VaultCredentialForm({
  editing,
  onSubmit,
  onCancel
}: {
  editing?: { summary: VaultCredentialSummary; revealed: RevealedVaultCredential };
  onSubmit: (data: VaultCredentialInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [targetType, setTargetType] = useState<VaultCredentialTargetType>(editing?.summary.target_type ?? "other");
  const [targetId, setTargetId] = useState<string | null>(editing?.summary.target_id ?? null);
  const [label, setLabel] = useState(editing?.summary.label ?? "");
  const [username, setUsername] = useState(editing?.revealed.username ?? "");
  const [password, setPassword] = useState(editing?.revealed.password ?? "");
  const [notes, setNotes] = useState(editing?.revealed.notes ?? "");
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSwitches().then(setSwitches).catch(() => {});
    listInventory({}).then(setInventory).catch(() => {});
  }, []);

  function handleTargetTypeChange(next: VaultCredentialTargetType) {
    setTargetType(next);
    setTargetId(null);
    if (next === "other") setLabel("");
  }

  function handleTargetIdChange(id: string) {
    setTargetId(id || null);
    if (!id) return;
    const found =
      targetType === "switch" ? switches.find((s) => s.id === id)?.name : inventory.find((i) => i.id === id)?.name;
    if (found) setLabel(found);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError("Etiket zorunludur");
      return;
    }
    if (!username || !password) {
      setError("Kullanıcı adı ve şifre zorunludur");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        target_type: targetType,
        target_id: targetType === "other" ? null : targetId,
        label: label.trim(),
        username,
        password,
        notes: notes.trim() || null
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}

      <div>
        <label className={labelClass}>Hedef</label>
        <select
          className={inputClass}
          value={targetType}
          onChange={(e) => handleTargetTypeChange(e.target.value as VaultCredentialTargetType)}
        >
          <option value="other">Serbest etiket</option>
          <option value="switch">Switch</option>
          <option value="inventory">Envanter</option>
        </select>
      </div>

      {targetType === "switch" && (
        <div>
          <label className={labelClass}>Switch Seç</label>
          <select className={inputClass} value={targetId ?? ""} onChange={(e) => handleTargetIdChange(e.target.value)}>
            <option value="">— seçin —</option>
            {switches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {targetType === "inventory" && (
        <div>
          <label className={labelClass}>Envanter Cihazı Seç</label>
          <select className={inputClass} value={targetId ?? ""} onChange={(e) => handleTargetIdChange(e.target.value)}>
            <option value="">— seçin —</option>
            {inventory.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass}>Etiket *</label>
        <input
          className={inputClass}
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ör. Core Switch — konsol erişimi"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Kullanıcı Adı *</label>
          <input
            className={inputClass}
            required
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Şifre *</label>
          <input
            className={inputClass}
            required
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Not (opsiyonel)</label>
        <textarea
          className={inputClass}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ör. enable secret, VPN notu..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
        >
          Vazgeç
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </form>
  );
}
