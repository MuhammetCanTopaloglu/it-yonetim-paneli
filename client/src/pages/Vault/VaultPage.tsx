import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { getVaultStatus, lockVault } from "../../api/vault";
import type { VaultStatus } from "../../types";
import VaultSetupForm from "./VaultSetupForm";
import VaultUnlockForm from "./VaultUnlockForm";
import VaultCredentialList from "./VaultCredentialList";

/** sendBeacon body sabit — /lock body almaz, sadece POST'un gitmesi yeterli. */
function bestEffortLock() {
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/vault/lock", new Blob([], { type: "text/plain" }));
      return;
    }
  } catch {
    // yut, aşağıdaki fetch fallback'i dener
  }
  fetch("/api/vault/lock", { method: "POST", keepalive: true }).catch(() => {});
}

export default function VaultPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unlockedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const s = await getVaultStatus();
      setStatus(s);
      unlockedRef.current = s.unlocked;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kasa durumu alınamadı");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Katman 1: Kasa sayfasından GERÇEKTEN ayrılınca (route değişimi → bu
  // bileşen unmount olunca) kasayı kilitle. Modal açma/kapama gibi
  // VaultCredentialList içindeki değişiklikler bu bileşeni unmount etmez,
  // bu yüzden agresif değildir — sadece sayfa değişince tetiklenir.
  useEffect(() => {
    return () => {
      if (unlockedRef.current) {
        lockVault().catch(() => {});
      }
    };
  }, []);

  // Katman 2: Sekme/tarayıcı kapanınca veya sekme arka plana geçince
  // best-effort kilitle (garanti değil, ama denenir).
  useEffect(() => {
    function handleUnloadOrHide() {
      if (unlockedRef.current && document.visibilityState === "hidden") {
        bestEffortLock();
      }
    }
    function handleBeforeUnload() {
      if (unlockedRef.current) {
        bestEffortLock();
      }
    }
    document.addEventListener("visibilitychange", handleUnloadOrHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleUnloadOrHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, []);

  // Backend zaten requireAdmin ile korur, ama normal kullanıcı URL'e
  // doğrudan giderse burada da yönlendirilip boş/yetkisiz bir ekranda takılı
  // kalmasın (UsersPage'deki aynı desen).
  if (user && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  if (!status) {
    return <p className="text-sm text-tertiary">Yükleniyor...</p>;
  }

  if (!status.exists) {
    return <VaultSetupForm onDone={load} />;
  }

  if (!status.unlocked) {
    return <VaultUnlockForm status={status} onUnlocked={load} />;
  }

  return <VaultCredentialList onLocked={load} />;
}
