import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "admin" | "user";

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  needsSetup: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setupFirstAdmin: (username: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.ok) return (await r.json()) as AuthUser;
        // Giriş yapılmamış — users tablosu boşsa (ilk kurulum) Login yerine
        // "İlk Admin Hesabı Oluştur" ekranı gösterilecek (bkz. App.tsx).
        const statusRes = await fetch("/api/auth/first-run-status");
        const status = await statusRes.json().catch(() => ({ needsSetup: false }));
        setNeedsSetup(Boolean(status.needsSetup));
        return null;
      })
      .then((u) => setUser(u))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Herhangi bir modül API çağrısı 401 dönerse (session süresi dolmuş,
    // sunucudan iptal edilmiş vb.) kullanıcıyı otomatik login ekranına
    // düşürür — takılı kalmaz. /api/auth/* kendi 401'lerini (yanlış şifre,
    // kilit) normal şekilde formda gösterdiği için buradan hariç tutulur.
    // /api/vault/unlock ve /api/vault/change-master-password de aynı sebeple
    // hariç: YANLIŞ ANA PAROLA kendi 401'ini döner ama bu app OTURUMUNUN
    // süresinin dolmasıyla İLGİSİZ — hariç tutulmazsa yanlış ana parola
    // girmek kullanıcıyı yanlışlıkla UYGULAMADAN da çıkarır (kasa dışı hiçbir
    // şey bundan etkilenmemeli).
    const VAULT_PASSWORD_EXEMPT_URLS = ["/api/vault/unlock", "/api/vault/change-master-password"];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      const input = args[0];
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isExempt = url.startsWith("/api/auth/") || VAULT_PASSWORD_EXEMPT_URLS.includes(url);
      if (res.status === 401 && url.startsWith("/api/") && !isExempt) {
        setUser(null);
      }
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error ?? "Giriş başarısız");
    }
    setUser(body as AuthUser);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const setupFirstAdmin = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/setup-first-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error ?? "Kurulum başarısız");
    }
    setNeedsSetup(false);
    setUser(body as AuthUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, login, logout, setupFirstAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
