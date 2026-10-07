import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getVaultStatus } from "../api/vault";
import type { VaultStatus } from "../types";
import VaultUnlockForm from "../pages/Vault/VaultUnlockForm";

/**
 * Kasa dışındaki bir sayfada (ör. Lisanslar) 423 alındığında gösterilecek
 * gömülü "ana parola gir → kasayı aç" bloğu. Mevcut VaultUnlockForm'u
 * (compact modda) yeniden kullanır — ikinci bir unlock akışı YOK. "Sayfadan
 * çıkınca kasayı kilitle" kuralına (VaultPage.tsx) hiç dokunmuyor; bu sadece
 * zaten kilitliyken aynı sayfadan açabilmeyi sağlıyor.
 */
export default function VaultUnlockInline({ onUnlocked }: { onUnlocked: () => void }) {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVaultStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : "Kasa durumu alınamadı"));
  }, []);

  if (error) return <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>;
  if (!status) return <p className="text-sm text-tertiary">Yükleniyor...</p>;

  if (!status.exists) {
    return (
      <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">
        Kasa henüz kurulmamış. Önce{" "}
        <Link to="/vault" className="underline font-medium">
          Kasa
        </Link>{" "}
        sayfasından ana parola belirleyin.
      </p>
    );
  }

  return <VaultUnlockForm status={status} onUnlocked={onUnlocked} compact />;
}
