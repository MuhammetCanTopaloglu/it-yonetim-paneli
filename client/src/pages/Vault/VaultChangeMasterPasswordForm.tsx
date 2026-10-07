import { useState, type FormEvent } from "react";
import { changeMasterPassword } from "../../api/vault";
import { checkMasterPasswordStrength } from "./masterPasswordStrength";
import Modal from "../../components/Modal";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

export default function VaultChangeMasterPasswordForm({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reencryptedCount: number } | null>(null);

  const strength = checkMasterPasswordStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!strength.ok) {
      setError(strength.reason ?? "Yeni ana parola yeterince güçlü değil");
      return;
    }
    if (!passwordsMatch) {
      setError("Yeni parolalar eşleşmiyor");
      return;
    }

    setSaving(true);
    try {
      const result = await changeMasterPassword(oldPassword, newPassword);
      setDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ana parola değiştirilemedi");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Modal title="Ana Parola Değiştirildi" onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-success bg-success-soft rounded-md px-3 py-2">
            Ana parola değiştirildi. {done.reencryptedCount} kayıt yeni parolayla yeniden şifrelendi.
          </p>
          <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">
            Önceki yedek dosyaları hâlâ ESKİ ana parolayı kullanır — güncel kalmaları için yeni bir yedek
            almanızı öneririz.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
            >
              Tamam
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Ana Parolayı Değiştir" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}

        <div>
          <label className={labelClass}>Mevcut Ana Parola</label>
          <input
            type="password"
            className={inputClass}
            autoComplete="current-password"
            autoFocus
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Yeni Ana Parola</label>
          <input
            type="password"
            className={inputClass}
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {newPassword.length > 0 && (
            <p className={`text-xs mt-1 ${strength.ok ? "text-success" : "text-danger"}`}>
              {strength.ok ? "✓ Yeterince güçlü" : strength.reason}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Yeni Ana Parola (Tekrar)</label>
          <input
            type="password"
            className={inputClass}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {confirm.length > 0 && !passwordsMatch && (
            <p className="text-xs mt-1 text-danger">Parolalar eşleşmiyor</p>
          )}
        </div>

        <p className="text-xs text-tertiary">
          Tüm kayıtlar yeni parolayla yeniden şifrelenecek. İşlem tamamlanana kadar mevcut parolanız
          geçerliliğini korur — bir hata olursa hiçbir şey değişmez.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving || !strength.ok || !passwordsMatch}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Değiştiriliyor..." : "Ana Parolayı Değiştir"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
