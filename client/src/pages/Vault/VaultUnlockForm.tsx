import { useState, type FormEvent, type KeyboardEvent } from "react";
import { unlockVault } from "../../api/vault";
import type { VaultStatus } from "../../types";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

/**
 * `compact`: Kasa sayfası dışından (ör. Lisanslar) gömülü kullanım için —
 * tam sayfa ortalama/üst boşluk olmadan, çağıranın kendi konteynerine
 * oturur. Mantık (unlock çağrısı, kilitlenme mesajı) birebir aynı, kod
 * tekrarı yok.
 *
 * KRİTİK: `compact` modda gerçek bir <form> ELEMENTİ KULLANMIYORUZ, çünkü bu
 * bileşen başka bir <form>'un (ör. LicenseForm) İÇİNDE render ediliyor —
 * nested <form> tarayıcıda geçersiz ve gözlemlenen davranış: "Kasayı Aç"a
 * basmak preventDefault()/stopPropagation()'a RAĞMEN tam sayfa yenilemeye
 * (native submit navigasyonu) yol açıyordu, bu da dış formun (lisans kaydı)
 * tüm state'ini siliyor ve yarım kalan kayıt işlemini kaybettiriyordu.
 * Bunun yerine: düz bir <div>, buton type="button" (asla implicit submit
 * tetiklemez), Enter tuşu manuel onKeyDown ile aynı fonksiyonu çağırır.
 */
export default function VaultUnlockForm({
  status,
  onUnlocked,
  compact
}: {
  status: VaultStatus;
  onUnlocked: () => void;
  compact?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedUntilText = status.locked && status.lockedUntil ? formatLockedUntil(status.lockedUntil) : null;

  async function doUnlock() {
    if (submitting || lockedUntilText) return;
    setError(null);
    setSubmitting(true);
    try {
      await unlockVault(password);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kasa açılamadı");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void doUnlock();
  }

  function handlePasswordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (compact && e.key === "Enter") {
      e.preventDefault();
      void doUnlock();
    }
  }

  const fields = (
    <>
      {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}
      {lockedUntilText && (
        <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">
          Çok fazla başarısız deneme — {lockedUntilText} kadar kilitli.
        </p>
      )}

      <div>
        <label className={labelClass}>Ana Parola</label>
        <input
          type="password"
          className={inputClass}
          autoComplete="current-password"
          autoFocus
          disabled={!!lockedUntilText}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handlePasswordKeyDown}
        />
      </div>

      <button
        type={compact ? "button" : "submit"}
        onClick={compact ? () => void doUnlock() : undefined}
        disabled={submitting || !!lockedUntilText}
        className="w-full px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 mt-2"
      >
        {submitting ? "Açılıyor..." : "Kasayı Aç"}
      </button>
    </>
  );

  if (compact) {
    return (
      <div className="rounded-lg border bg-surface p-4">
        <h3 className="text-sm font-semibold text-primary mb-1">🔒 Kasa Kilitli</h3>
        <p className="text-xs text-tertiary mb-3">Devam etmek için ana parolayı girin.</p>
        <div className="space-y-3">{fields}</div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="rounded-lg border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-primary mb-1">🔒 Kasa Kilitli</h2>
        <p className="text-xs text-tertiary mb-4">Devam etmek için ana parolayı girin.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields}
        </form>
      </div>
    </div>
  );
}

function formatLockedUntil(iso: string): string {
  const remainingMs = new Date(iso).getTime() - Date.now();
  const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
  return `${remainingMin} dakika`;
}
