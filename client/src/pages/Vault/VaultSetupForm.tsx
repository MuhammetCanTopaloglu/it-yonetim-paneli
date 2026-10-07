import { useState, type FormEvent } from "react";
import { setupVault } from "../../api/vault";
import { checkMasterPasswordStrength } from "./masterPasswordStrength";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

/**
 * Kasa hiç kurulmamışken (GET /status → exists:false) gösterilir. Ana parola
 * ASLA kurtarılamaz — bu yüzden hem net bir kırmızı uyarı hem de zorunlu bir
 * onay checkbox'ı var (işaretlenmeden kurulum yapılamaz). Şifre alanı iki kez
 * istenir (typo riski, tek seferlik bir hata bile kalıcı veri kaybı demek).
 */
export default function VaultSetupForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = checkMasterPasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!strength.ok) {
      setError(strength.reason ?? "Ana parola yeterince güçlü değil");
      return;
    }
    if (!passwordsMatch) {
      setError("Parolalar eşleşmiyor");
      return;
    }
    if (!acknowledged) {
      setError("Devam etmek için onay kutusunu işaretlemelisiniz");
      return;
    }

    setSaving(true);
    try {
      await setupVault(password, acknowledged);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kasa kurulamadı");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="rounded-lg border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-primary mb-1">🔒 Kasa — Ana Parola Belirle</h2>
        <p className="text-xs text-tertiary mb-4">
          Kimlik bilgileri bu ana parolayla şifrelenecek. Kasa daha önce hiç kurulmadı.
        </p>

        <div className="rounded-md bg-danger-soft border border-danger/30 px-3 py-2.5 mb-4">
          <p className="text-sm text-danger font-medium">
            Bu parolayı unutursanız kasadaki TÜM veriler kalıcı olarak kurtarılamaz — hiçbir kurtarma yolu
            yoktur.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}

          <div>
            <label className={labelClass}>Ana Parola</label>
            <input
              type="password"
              className={inputClass}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password.length > 0 && (
              <p className={`text-xs mt-1 ${strength.ok ? "text-success" : "text-danger"}`}>
                {strength.ok ? "✓ Yeterince güçlü" : strength.reason}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Ana Parola (Tekrar)</label>
            <input
              type="password"
              className={inputClass}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && !passwordsMatch && (
              <p className="text-xs mt-1 text-danger">Parolalar eşleşmiyor</p>
            )}
          </div>

          <label className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-secondary">
              Ana parolayı unutursam kasadaki verilerin kalıcı olarak kaybolacağını okudum, kabul ediyorum.
            </span>
          </label>

          <button
            type="submit"
            disabled={saving || !strength.ok || !passwordsMatch || !acknowledged}
            className="w-full px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 mt-2"
          >
            {saving ? "Kuruluyor..." : "Kasayı Kur"}
          </button>
        </form>
      </div>
    </div>
  );
}
