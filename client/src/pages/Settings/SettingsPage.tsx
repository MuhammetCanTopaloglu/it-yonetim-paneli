import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTheme } from "../../theme/ThemeProvider";
import { EXPORT_URL, SuspiciousBackupError, backupFileName, importBackup } from "../../api/backup";
import { changePassword } from "../../api/auth";
import { getVaultStatus } from "../../api/vault";
import Modal from "../../components/Modal";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şifre değiştirilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border bg-surface p-4 mb-4">
      <h3 className="font-medium mb-3">Şifre Değiştir</h3>

      {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2 mb-3">{error}</p>}
      {success && (
        <p className="text-sm text-success bg-success-soft rounded-md px-3 py-2 mb-3">Şifreniz güncellendi.</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <label className={labelClass}>Mevcut şifre</label>
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Yeni şifre (en az 8 karakter)</label>
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Şifreyi Güncelle"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [suspiciousWarning, setSuspiciousWarning] = useState<SuspiciousBackupError | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [vaultExists, setVaultExists] = useState(false);
  // Seçilen yedek dosyasında kasa verisi var mı — varsa import onayında
  // "kaynak sistemin ana parolasını kullanmalısınız" uyarısı ayrı gösterilir.
  const [incomingHasVault, setIncomingHasVault] = useState(false);

  useEffect(() => {
    getVaultStatus()
      .then((s) => setVaultExists(s.exists))
      .catch(() => {});
  }, []);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setError(null);
    setSuccessMessage(null);
    setSuspiciousWarning(null);

    try {
      const parsed = JSON.parse(await file.text());
      setIncomingHasVault(Array.isArray(parsed?.tables?.vault_meta) && parsed.tables.vault_meta.length > 0);
    } catch {
      setIncomingHasVault(false);
    }

    setConfirmOpen(true);
  }

  async function runImport(confirm: boolean) {
    if (!pendingFile) return;
    setImporting(true);
    setError(null);
    try {
      const text = await pendingFile.text();
      const result = await importBackup(text, confirm);
      setSuccessMessage(`Geri yükleme tamamlandı: ${result.totalRows} kayıt yazıldı. Sayfa yenileniyor...`);
      setConfirmOpen(false);
      setSuspiciousWarning(null);
      setTimeout(() => window.location.reload(), 1500);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      if (err instanceof SuspiciousBackupError) {
        // Genel onayı geç, daha net ikinci bir uyarı göster — dosyayı elde tutmaya devam et
        setConfirmOpen(false);
        setSuspiciousWarning(err);
      } else {
        setError(err instanceof Error ? err.message : "Geri yükleme başarısız oldu");
        setConfirmOpen(false);
        setSuspiciousWarning(null);
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } finally {
      setImporting(false);
    }
  }

  function handleCancelImport() {
    setConfirmOpen(false);
    setSuspiciousWarning(null);
    setPendingFile(null);
    setIncomingHasVault(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Ayarlar</h2>

      <ChangePasswordSection />

      <section className="rounded-lg border bg-surface p-4 mb-4">
        <h3 className="font-medium mb-3">Görünüm</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Tema</p>
            <p className="text-xs text-secondary">
              Tercihiniz bu tarayıcıda hatırlanır.
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
          >
            {theme === "dark" ? "☀ Açık Temaya Geç" : "🌙 Koyu Temaya Geç"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-surface p-4">
        <h3 className="font-medium mb-3">Yedekleme</h3>

        {error && (
          <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2 mb-3">{error}</p>
        )}
        {successMessage && (
          <p className="text-sm text-success bg-success-soft rounded-md px-3 py-2 mb-3">
            {successMessage}
          </p>
        )}

        <div className="py-2 border-b">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">JSON Yedek İndir</p>
              <p className="text-xs text-secondary">
                Tüm tabloları tek dosyada indirir.
              </p>
            </div>
            <a
              href={EXPORT_URL}
              download={backupFileName()}
              className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
            >
              Yedekle
            </a>
          </div>
          {vaultExists && (
            <p className="text-xs text-danger bg-danger-soft rounded-md px-3 py-2 mt-2">
              Yedek dosyası kimlik kasanızı (şifreli) içerir. Dosya çalınırsa saldırgan ana parolanızı
              çevrimdışı kaba kuvvetle deneyebilir. Güçlü, benzersiz bir ana parola kullanın ve yedek
              dosyasını güvenli saklayın.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm">JSON'dan Geri Yükle</p>
            <p className="text-xs text-danger">
              Mevcut tüm veriyi siler ve dosyadakiyle değiştirir.
            </p>
          </div>
          <label className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary cursor-pointer">
            Dosya Seç
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileSelected}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-xs text-tertiary pt-2">
          Geri yüklemeden hemen önce mevcut verinin otomatik bir güvenlik yedeği alınır (son 5 tanesi saklanır).
        </p>
      </section>

      {confirmOpen && (
        <Modal title="Geri Yükleme Onayı" onClose={handleCancelImport}>
          <p className="text-sm mb-2">
            <strong>{pendingFile?.name}</strong> dosyasından geri yüklenecek.
          </p>
          <p className="text-sm text-danger font-medium mb-4">
            Mevcut tüm veri silinip dosyadaki veriyle değiştirilecek. Bu işlem geri alınamaz.
          </p>
          {incomingHasVault && (
            <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2 mb-4">
              Bu yedek bir kimlik kasası içeriyor — geri yükleme sonrası kasayı kaynak sistemin ana
              parolasıyla açmanız gerekir (yerel ana parolanız artık geçersiz olur).
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelImport}
              disabled={importing}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              onClick={() => runImport(false)}
              disabled={importing}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90 disabled:opacity-50"
            >
              {importing ? "Geri Yükleniyor..." : "Evet, Sil ve Geri Yükle"}
            </button>
          </div>
        </Modal>
      )}

      {suspiciousWarning && (
        <Modal title="⚠ Şüpheli Yedek" onClose={handleCancelImport}>
          <p className="text-sm text-danger font-medium mb-3">{suspiciousWarning.message}</p>
          <p className="text-sm mb-4">
            Bu yedek beklenenden çok daha az kayıt içeriyor — yanlış dosya seçmiş olabilirsiniz. Yine de
            devam etmek istiyorsanız aşağıdan onaylayın (öncesinin güvenlik yedeği otomatik alınacak).
          </p>
          {incomingHasVault && (
            <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2 mb-4">
              Bu yedek bir kimlik kasası içeriyor — geri yükleme sonrası kasayı kaynak sistemin ana
              parolasıyla açmanız gerekir (yerel ana parolanız artık geçersiz olur).
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelImport}
              disabled={importing}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              onClick={() => runImport(true)}
              disabled={importing}
              className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90 disabled:opacity-50"
            >
              {importing ? "Geri Yükleniyor..." : "Yine de Devam Et"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
