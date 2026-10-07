import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import Logo from "../components/Logo";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız");
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
          <h2 className="text-sm font-semibold text-primary mb-1">Giriş Yap</h2>

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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 mt-2"
          >
            {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </div>
  );
}
