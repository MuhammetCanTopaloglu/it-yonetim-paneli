import { useEffect, useState } from "react";
import { listChangelog } from "../../api/changelog";
import type { ChangelogAction, ChangelogEntry } from "../../types";
import ActionBadge from "../../components/ActionBadge";
import { TABLE_LABELS } from "../../lib/changelogLabels";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  create: "Oluşturuldu",
  update: "Güncellendi",
  delete: "Silindi",
  note: "Not"
};

const inputClass =
  "rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";

export default function ChangelogPage() {
  const [items, setItems] = useState<ChangelogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [tableName, setTableName] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const page = await listChangelog({
        q,
        table_name: tableName,
        action,
        date_from: dateFrom,
        date_to: dateTo,
        limit: PAGE_SIZE,
        offset: 0
      });
      setItems(page.items);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await listChangelog({
        q,
        table_name: tableName,
        action,
        date_from: dateFrom,
        date_to: dateTo,
        limit: PAGE_SIZE,
        offset: items.length
      });
      setItems((prev) => [...prev, ...page.items]);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tableName, action, dateFrom, dateTo]);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Değişiklik Günlüğü</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="Açıklamada ara..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputClass} flex-1 min-w-[200px]`}
        />
        <select value={tableName} onChange={(e) => setTableName(e.target.value)} className={inputClass}>
          <option value="">Tüm Tablolar</option>
          {Object.entries(TABLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={inputClass}>
          <option value="">Tüm İşlemler</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={inputClass}
          aria-label="Başlangıç tarihi"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={inputClass}
          aria-label="Bitiş tarihi"
        />
      </div>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      <div className="overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-secondary">
              <th className="px-3 py-2 font-medium">Zaman</th>
              <th className="px-3 py-2 font-medium">Tablo</th>
              <th className="px-3 py-2 font-medium">İşlem</th>
              <th className="px-3 py-2 font-medium">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-tertiary">
                  Yükleniyor...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-tertiary">
                  Kayıt bulunamadı
                </td>
              </tr>
            )}
            {!loading &&
              items.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0 hover:bg-surface-secondary transition-colors duration-150">
                  <td className="px-3 py-2 whitespace-nowrap text-secondary">
                    {new Date(entry.created_at).toLocaleString("tr-TR")}
                  </td>
                  <td className="px-3 py-2">{TABLE_LABELS[entry.table_name] ?? entry.table_name}</td>
                  <td className="px-3 py-2">
                    <ActionBadge action={entry.action as ChangelogAction} />
                  </td>
                  <td className="px-3 py-2">{entry.description}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-1.5 text-sm rounded-md border hover:bg-surface-secondary disabled:opacity-50"
          >
            {loadingMore ? "Yükleniyor..." : "Daha Fazla Yükle"}
          </button>
        </div>
      )}
    </div>
  );
}
