import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import Logo from "../components/Logo";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

const MIN_PASSWORD_LENGTH = 8;

/**
 * users tablosu tamamen boşken (ilk çalıştırma — özellikle paketlenmiş
 * Electron .exe'de, konsol görünmediği için rastgele şifreli otomatik seed
 * artık yapılmıyor) Login yerine gösterilir. Buradan oluşturulan ilk hesap
 * her zaman admin'dir.
 */
export default function FirstAdminSetup() {
  const { setupFirstAdmin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 3) {
      setError("Kullanıcı adı en az 3 karakter olmalı");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
      return;
    }
    if (!passwordsMatch) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    setSubmitting(true);
    try {
      await setupFirstAdmin(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kurulum başarısız");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-app px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <Logo />
          <div>
            <h1 className="text-sm font-semibold text-primary leading-tight">IT Yönetim Paneli</h1>
            <p className="text-[11px] text-tertiary leading-tight">Ağ &amp; Envanter</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border rounded-lg p-5 space-y-3 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-primary mb-1">İlk Admin Hesabı Oluştur</h2>
            <p className="text-xs text-tertiary">
              Bu, uygulamadaki ilk kurulum. Aşağıda belirlediğin kullanıcı adı/şifre ile admin hesabı oluşturulacak
              ve otomatik giriş yapılacak.
            </p>
          </div>

          {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}

          <div>
            <label className={labelClass}>Kullanıcı adı</label>
            <input
              className={inputClass}
              autoFocus
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Şifre</label>
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-[11px] text-tertiary mt-1">En az {MIN_PASSWORD_LENGTH} karakter.</p>
          </div>

          <div>
            <label className={labelClass}>Şifre (Tekrar)</label>
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && !passwordsMatch && (
              <p className="text-xs mt-1 text-danger">Şifreler eşleşmiyor</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 mt-2"
          >
            {submitting ? "Oluşturuluyor..." : "Admin Hesabı Oluştur"}
          </button>
        </form>
      </div>
    </div>
  );
}
