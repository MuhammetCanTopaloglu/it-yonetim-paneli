import { useState, type FormEvent } from "react";
import { VaultLockedError } from "../../api/vault";
import VaultUnlockInline from "../../components/VaultUnlockInline";
import AttachmentList from "../../components/AttachmentList";
import type { License, LicenseFormData } from "../../types";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

const CURRENCIES = ["TRY", "USD", "EUR"];

/**
 * Yeni kayıt VEYA düzenleme. Lisans anahtarı ASLA önceden doldurulmaz
 * (reveal edilmiş hâli bile burada tutulmaz) — boş bırakılırsa mevcut
 * şifreli anahtar dokunulmadan korunur (bkz. api/licenses.ts LicenseFormData
 * yorumu). "Anahtarı kaldır" işaretlenirse boş string gönderilir, backend
 * bunu açıkça temizleme isteği olarak yorumlar.
 */
export default function LicenseForm({
  license,
  onSubmit,
  onCancel
}: {
  license?: License;
  onSubmit: (data: LicenseFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [productName, setProductName] = useState(license?.product_name ?? "");
  const [vendor, setVendor] = useState(license?.vendor ?? "");
  const [totalSeats, setTotalSeats] = useState(license?.total_seats ?? 1);
  const [purchaseDate, setPurchaseDate] = useState(license?.purchase_date ?? "");
  const [startDate, setStartDate] = useState(license?.start_date ?? "");
  const [renewalDate, setRenewalDate] = useState(license?.renewal_date ?? "");
  const [cost, setCost] = useState(license?.cost != null ? String(license.cost) : "");
  const [currency, setCurrency] = useState(license?.currency ?? "TRY");
  const [notes, setNotes] = useState(license?.notes ?? "");
  const [licenseKey, setLicenseKey] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultLocked, setVaultLocked] = useState(false);
  // Kasa kilitliyken denenen kaydı burada tutuyoruz — inline "kasayı aç"
  // formu başarıyla açtığında AYNI veriyle otomatik yeniden dener, kullanıcı
  // "Kaydet"e ikinci kez basmak zorunda kalmaz.
  const [pendingData, setPendingData] = useState<LicenseFormData | null>(null);

  function buildData(): LicenseFormData | null {
    if (!productName.trim()) {
      setError("Ürün adı zorunludur");
      return null;
    }
    if (!Number.isInteger(totalSeats) || totalSeats < 1) {
      setError("Koltuk sayısı en az 1 olan bir tam sayı olmalı");
      return null;
    }

    const data: LicenseFormData = {
      product_name: productName.trim(),
      vendor: vendor.trim() || null,
      total_seats: totalSeats,
      purchase_date: purchaseDate || null,
      start_date: startDate || null,
      renewal_date: renewalDate || null,
      cost: cost ? Number(cost) : null,
      currency,
      notes: notes.trim() || null
    };
    if (removeKey) {
      data.license_key = "";
    } else if (licenseKey) {
      data.license_key = licenseKey;
    }
    return data;
  }

  async function trySubmit(data: LicenseFormData) {
    setSaving(true);
    try {
      await onSubmit(data);
      setPendingData(null);
    } catch (err) {
      if (err instanceof VaultLockedError) {
        setVaultLocked(true);
        setPendingData(data);
      } else {
        setError(err instanceof Error ? err.message : "Kaydedilemedi");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setVaultLocked(false);

    const data = buildData();
    if (!data) return;
    await trySubmit(data);
  }

  async function handleVaultUnlocked() {
    setVaultLocked(false);
    if (pendingData) {
      await trySubmit(pendingData);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}
      {vaultLocked && (
        <div className="space-y-2">
          <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">
            Lisans anahtarını kaydetmek için kasa açık olmalı.
          </p>
          <VaultUnlockInline onUnlocked={handleVaultUnlocked} />
        </div>
      )}

      <div>
        <label className={labelClass}>Ürün Adı *</label>
        <input className={inputClass} required value={productName} onChange={(e) => setProductName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Tedarikçi</label>
          <input className={inputClass} value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Koltuk Sayısı *</label>
          <input
            className={inputClass}
            type="number"
            min={1}
            required
            value={totalSeats}
            onChange={(e) => setTotalSeats(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Satın Alma Tarihi</label>
          <input
            className={inputClass}
            type="date"
            value={purchaseDate ?? ""}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Başlangıç Tarihi</label>
          <input className={inputClass} type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Yenileme Tarihi</label>
          <input
            className={inputClass}
            type="date"
            value={renewalDate ?? ""}
            onChange={(e) => setRenewalDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Maliyet</label>
          <input
            className={inputClass}
            type="number"
            step="0.01"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Para Birimi</label>
          <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>
          Lisans Anahtarı {license?.has_key && !removeKey ? "(değiştirmek için gir, boşsa mevcut korunur)" : ""}
        </label>
        <input
          className={inputClass}
          type="text"
          autoComplete="off"
          disabled={removeKey}
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder={license?.has_key ? "••••••••" : "ör. XXXXX-XXXXX-XXXXX"}
        />
        {license?.has_key && (
          <label className="flex items-center gap-1.5 mt-1.5 text-xs text-secondary">
            <input
              type="checkbox"
              checked={removeKey}
              onChange={(e) => {
                setRemoveKey(e.target.checked);
                if (e.target.checked) setLicenseKey("");
              }}
            />
            Anahtarı kaldır
          </label>
        )}
        <p className="text-[11px] text-tertiary mt-1">
          Anahtar kasanın ana parolasıyla şifrelenir — girmek veya değiştirmek için kasa açık olmalı.
        </p>
      </div>

      <div>
        <label className={labelClass}>Notlar</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div>
        <label className={labelClass}>Dosya Ekleri / Fatura</label>
        <AttachmentList ownerType="license" ownerId={license?.id} />
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
