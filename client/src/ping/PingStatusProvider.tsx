import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { runPingCheck } from "../api/ping";
import type { PingCheckResult } from "../types";

/**
 * Ping sonucu Dashboard'da VEYA Topoloji sekmesinde tetiklenebilir — ikisi de
 * bu paylaşılan state'i kullanır. Bir yerden "Şimdi Kontrol Et" ile tetiklenen
 * kontrolün sonucu diğer sayfada da (o sayfaya geçilince) aynı anda görünür;
 * sayfalar arası geçişte kaybolmaz. Sonuç DB'ye YAZILMIYOR (bilinçli karar —
 * anlık/geçici bir görünüm), bu yüzden bu state sadece bellekte tutulur:
 * sayfa yenilenince (F5) sıfırlanır, yeniden kontrol gerekir.
 */
interface PingStatusContextValue {
  result: PingCheckResult | null;
  loading: boolean;
  error: string | null;
  runCheck: () => Promise<void>;
}

const PingStatusContext = createContext<PingStatusContextValue | null>(null);

export function PingStatusProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<PingCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await runPingCheck();
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kontrol başarısız oldu");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <PingStatusContext.Provider value={{ result, loading, error, runCheck }}>
      {children}
    </PingStatusContext.Provider>
  );
}

export function usePingStatus(): PingStatusContextValue {
  const ctx = useContext(PingStatusContext);
  if (!ctx) throw new Error("usePingStatus must be used within PingStatusProvider");
  return ctx;
}
