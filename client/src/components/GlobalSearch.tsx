import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { globalSearch } from "../api/search";
import type { SearchResults } from "../types";

const MIN_LENGTH = 2;

interface FlatResult {
  key: string;
  group: string;
  label: string;
  subtitle?: string;
  to: string;
}

const STATUS_LABELS: Record<string, string> = {
  bekliyor: "Bekliyor",
  devam_ediyor: "Devam Ediyor",
  tamam: "Tamam"
};

const PRIORITY_LABELS: Record<string, string> = {
  dusuk: "Düşük",
  orta: "Orta",
  yuksek: "Yüksek"
};

function flatten(results: SearchResults): { group: string; items: FlatResult[] }[] {
  const groups: { group: string; items: FlatResult[] }[] = [];

  if (results.switches.length > 0) {
    groups.push({
      group: "Switch'ler",
      items: results.switches.map((s) => ({
        key: `switch-${s.id}`,
        group: "Switch'ler",
        label: s.name,
        subtitle: [s.model, s.management_ip, s.location].filter(Boolean).join(" · ") || undefined,
        to: "/switches"
      }))
    });
  }

  if (results.inventory.length > 0) {
    groups.push({
      group: "Envanter",
      items: results.inventory.map((i) => ({
        key: `inventory-${i.id}`,
        group: "Envanter",
        label: i.name,
        subtitle:
          [i.type, i.brand_model, i.serial_no, i.ip_address, i.location].filter(Boolean).join(" · ") ||
          undefined,
        to: "/inventory"
      }))
    });
  }

  if (results.ip_assignments.length > 0) {
    groups.push({
      group: "IP Eşleştirmeleri",
      items: results.ip_assignments.map((a) => ({
        key: `ip-${a.id}`,
        group: "IP Eşleştirmeleri",
        label: a.ip_address,
        subtitle: [a.device_name, a.subnet_name].filter(Boolean).join(" · ") || undefined,
        to: "/network"
      }))
    });
  }

  if (results.notes.length > 0) {
    groups.push({
      group: "Notlar",
      items: results.notes.map((n) => ({
        key: `note-${n.id}`,
        group: "Notlar",
        label: n.title,
        subtitle: n.tags ? n.tags.split(",").map((t) => `#${t.trim()}`).join(" ") : undefined,
        to: "/notes"
      }))
    });
  }

  if (results.todos.length > 0) {
    groups.push({
      group: "Görevler",
      items: results.todos.map((t) => ({
        key: `todo-${t.id}`,
        group: "Görevler",
        label: t.title,
        subtitle: `${STATUS_LABELS[t.status] ?? t.status} · ${PRIORITY_LABELS[t.priority] ?? t.priority}`,
        to: "/todo"
      }))
    });
  }

  return groups;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (query.trim().length < MIN_LENGTH) {
      setResults(null);
      setOpen(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await globalSearch(query.trim());
        setResults(data);
        setOpen(true);
        setSelectedIndex(0);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const groups = useMemo(() => (results ? flatten(results) : []), [results]);
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const hasResults = flatItems.length > 0;

  function goTo(item: FlatResult) {
    navigate(item.to);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || flatItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) goTo(item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  let runningIndex = -1;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (results) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Ara: switch, envanter, IP, not, görev..."
        className="w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
      />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 mt-1 w-full max-h-96 overflow-y-auto rounded-md border bg-surface shadow-card"
          >
            {loading && <p className="px-3 py-3 text-sm text-tertiary">Aranıyor...</p>}
            {!loading && !hasResults && (
              <p className="px-3 py-3 text-sm text-tertiary">Sonuç bulunamadı</p>
            )}
            {!loading &&
              groups.map((g) => (
                <div key={g.group}>
                  <p className="px-3 pt-2 pb-1 text-xs font-medium text-tertiary">{g.group}</p>
                  {g.items.map((item) => {
                    runningIndex += 1;
                    const isSelected = runningIndex === selectedIndex;
                    return (
                      <button
                        key={item.key}
                        onClick={() => goTo(item)}
                        onMouseEnter={() => setSelectedIndex(runningIndex)}
                        className={`block w-full text-left px-3 py-1.5 text-sm transition-colors duration-100 ${
                          isSelected ? "bg-accent-soft text-accent" : "hover:bg-surface-secondary"
                        }`}
                      >
                        <div className="font-medium">{item.label}</div>
                        {item.subtitle && (
                          <div className="text-xs text-tertiary truncate">{item.subtitle}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
