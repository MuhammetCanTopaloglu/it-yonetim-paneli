import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../auth/AuthProvider";
import GlobalSearch from "./GlobalSearch";
import PageTransition from "./PageTransition";
import Logo from "./Logo";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/switches", label: "Switch Yönetimi" },
  { to: "/inventory", label: "Envanter" },
  { to: "/licenses", label: "Lisanslar" },
  { to: "/network", label: "IP / Ağ Planı" },
  { to: "/todo", label: "To-Do" },
  { to: "/notes", label: "Notlar / Runbook" },
  { to: "/changelog", label: "Değişiklik Günlüğü" },
  { to: "/settings", label: "Ayarlar" },
  { to: "/help", label: "Yardım / Kılavuz" }
];

const adminNavItems: { to: string; label: string; end?: boolean }[] = [
  { to: "/vault", label: "🔒 Kasa" },
  { to: "/users", label: "Kullanıcı Yönetimi" }
];

export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const items = user?.role === "admin" ? [...navItems, ...adminNavItems] : navItems;

  return (
    <div className="flex h-dvh">
      <aside className="w-60 shrink-0 border-r bg-surface flex flex-col h-full">
        <div className="px-4 py-4 border-b flex items-center gap-2.5 shrink-0">
          <Logo />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-primary leading-tight truncate">IT Yönetim Paneli</h1>
            <p className="text-[11px] text-tertiary leading-tight">Ağ &amp; Envanter</p>
          </div>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-2">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="relative block mb-0.5">
              {({ isActive }) => (
                <span
                  className={`relative flex items-center px-3 py-2 text-sm rounded-md transition-colors duration-150 ${
                    isActive
                      ? "text-accent font-medium bg-accent-soft"
                      : "text-secondary hover:bg-surface-secondary hover:text-primary"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mx-3 mb-3 shrink-0 flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-tertiary truncate" title={user?.username}>
            {user?.username}
          </span>
          <button
            onClick={logout}
            className="text-xs text-secondary hover:text-danger transition-colors duration-150"
          >
            Çıkış Yap
          </button>
        </div>
        <button
          onClick={toggleTheme}
          className="mx-3 mb-3 shrink-0 px-3 py-2 text-sm rounded-md border hover:bg-surface-secondary transition-colors duration-150 active:scale-[0.98]"
        >
          {theme === "dark" ? "☀ Açık Tema" : "🌙 Koyu Tema"}
        </button>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="border-b bg-surface px-6 py-3 flex justify-center shrink-0">
          <GlobalSearch />
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto p-6">
          <PageTransition />
        </main>
      </div>
    </div>
  );
}
