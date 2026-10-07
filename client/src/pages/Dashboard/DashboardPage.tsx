import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getDashboard } from "../../api/dashboard";
import { usePingStatus } from "../../ping/PingStatusProvider";
import HealthSummary from "./HealthSummary";
import type { DashboardData, OfflineDevice } from "../../types";
import StatCard from "../../components/StatCard";
import PriorityBadge from "../../components/PriorityBadge";
import ActionBadge from "../../components/ActionBadge";
import Skeleton from "../../components/Skeleton";
import { TABLE_LABELS } from "../../lib/changelogLabels";
import { formatDueDate, getDueUrgency } from "../../lib/dueDate";
import { formatDaysRemaining, formatWarrantyDate } from "../../lib/warranty";
import { formatDaysRemaining as formatLicenseDaysRemaining, formatRenewalDate, renewalToneForDays } from "../../lib/licenseRenewal";
import type { WarrantyItem, LicenseRenewalItem } from "../../types";

const URGENCY_CLASS: Record<string, string> = {
  overdue: "text-danger font-medium",
  today: "text-warning font-medium",
  normal: "text-secondary"
};

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18 } }
};

function DashboardSkeleton() {
  return (
    <div>
      <Skeleton className="h-7 w-32 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-[10px] border bg-surface p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-surface p-4 shadow-panel">
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { result: pingResult, loading: pingLoading, error: pingError, runCheck: handlePingCheck } = usePingStatus();

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return <p className="text-sm text-danger">{error ?? "Veri alınamadı"}</p>;
  }

  const { counts, upcomingTasks, recentChangelog, warranty, licenseRenewal } = data;

  return (
    <div>
      <h2 className="text-xl font-semibold text-primary mb-4">Dashboard</h2>

      <HealthSummary data={data} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Toplam Switch" value={counts.totalSwitches} onClick={() => navigate("/switches")} />
        <StatCard label="Toplam Envanter" value={counts.totalInventory} onClick={() => navigate("/inventory")} />
        <StatCard label="Açık Görev" value={counts.openTasks} onClick={() => navigate("/todo")} />
        <StatCard
          label="Arızalı Cihaz"
          value={counts.faultyInventory}
          danger={counts.faultyInventory > 0}
          onClick={() => navigate("/inventory?status=arizali")}
        />
        <StatCard
          label="Subnet / IP"
          value={`${counts.totalSubnets} / ${counts.totalIpAssignments}`}
          subtitle="subnet / IP eşleştirme"
          onClick={() => navigate("/network")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border bg-surface p-5 shadow-panel">
          <h3 className="font-semibold text-primary mb-3">Yaklaşan Görevler</h3>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-tertiary">Henüz yaklaşan görev yok.</p>
          ) : (
            <motion.ul variants={listVariants} initial="hidden" animate="show" className="space-y-1">
              {upcomingTasks.map((task) => {
                const urgency = task.due_date ? getDueUrgency(task.due_date) : "normal";
                return (
                  <motion.li
                    variants={itemVariants}
                    key={task.id}
                    className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 cursor-pointer hover:bg-surface-secondary -mx-2 px-2 rounded-md transition-colors duration-150"
                    onClick={() => navigate("/todo")}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-primary truncate">{task.title}</p>
                      {task.due_date && (
                        <p className={`text-xs ${URGENCY_CLASS[urgency]}`}>
                          {urgency === "overdue" ? "Gecikti: " : urgency === "today" ? "Bugün: " : ""}
                          {formatDueDate(task.due_date)}
                        </p>
                      )}
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </section>

        <section className="rounded-xl border bg-surface p-5 shadow-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-primary">Son Değişiklikler</h3>
            <button onClick={() => navigate("/changelog")} className="text-xs text-accent hover:underline">
              Tümünü gör
            </button>
          </div>
          {recentChangelog.length === 0 ? (
            <p className="text-sm text-tertiary">Henüz kayıt yok.</p>
          ) : (
            <motion.ul variants={listVariants} initial="hidden" animate="show" className="space-y-1">
              {recentChangelog.map((entry) => (
                <motion.li variants={itemVariants} key={entry.id} className="py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <ActionBadge action={entry.action} />
                    <span className="text-xs text-tertiary">
                      {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                    </span>
                    <span className="text-xs text-tertiary ml-auto">
                      {new Date(entry.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <p className="text-sm text-primary">{entry.description}</p>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border bg-surface p-5 shadow-panel mt-4">
        <h3 className="font-semibold text-primary mb-3">Garanti Durumu</h3>
        {warranty.expired.length === 0 && warranty.upcoming.length === 0 ? (
          <p className="text-sm text-tertiary">Garantisi yaklaşan veya dolmuş cihaz yok.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WarrantyList
              title="Garantisi Dolmuş"
              items={warranty.expired}
              emptyText="Garantisi dolmuş cihaz yok."
              tone="danger"
              onItemClick={(item) => navigate(`/inventory?q=${encodeURIComponent(item.name)}`)}
            />
            <WarrantyList
              title="Yaklaşan (90 gün içinde)"
              items={warranty.upcoming}
              emptyText="Yaklaşan garanti bitişi yok."
              tone="warning"
              onItemClick={(item) => navigate(`/inventory?q=${encodeURIComponent(item.name)}`)}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-surface p-5 shadow-panel mt-4">
        <h3 className="font-semibold text-primary mb-3">Lisans Durumu</h3>
        {licenseRenewal.expired.length === 0 && licenseRenewal.upcoming.length === 0 ? (
          <p className="text-sm text-tertiary">Yenileme tarihi yaklaşan veya geçmiş lisans yok.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LicenseRenewalList
              title="Süresi Dolmuş"
              items={licenseRenewal.expired}
              emptyText="Süresi dolmuş lisans yok."
              onItemClick={(item) => navigate(`/licenses?q=${encodeURIComponent(item.product_name)}`)}
            />
            <LicenseRenewalList
              title="Yaklaşan (60 gün içinde, ≤14 gün acil)"
              items={licenseRenewal.upcoming}
              emptyText="Yaklaşan lisans yenilemesi yok."
              onItemClick={(item) => navigate(`/licenses?q=${encodeURIComponent(item.product_name)}`)}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-surface p-5 shadow-panel mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-primary">Ağ Erişilebilirliği</h3>
          <button
            onClick={handlePingCheck}
            disabled={pingLoading}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {pingLoading ? "Kontrol ediliyor..." : "Şimdi Kontrol Et"}
          </button>
        </div>

        {pingError && (
          <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2 mb-3">{pingError}</p>
        )}

        {!pingResult && !pingLoading && !pingError && (
          <p className="text-sm text-tertiary">
            IP adresi/yönetim IP'si tanımlı envanter cihazlarına ve switch'lere ping atıp erişilebilirliği kontrol
            eder. Henüz kontrol edilmedi.
          </p>
        )}

        {pingLoading && <p className="text-sm text-tertiary">Cihazlara ping atılıyor, birkaç saniye sürebilir...</p>}

        {pingResult && !pingLoading && (
          <div>
            <p className="text-xs text-tertiary mb-3">
              Son kontrol: {new Date(pingResult.checkedAt).toLocaleString("tr-TR")} · {pingResult.total} cihaz
              kontrol edildi
            </p>

            {pingResult.total === 0 ? (
              <p className="text-sm text-tertiary">IP tanımlı envanter cihazı veya switch yok.</p>
            ) : pingResult.offline === 0 ? (
              <p className="text-sm text-success">
                ✓ Tüm cihazlar çevrimiçi ({pingResult.online}/{pingResult.total}).
              </p>
            ) : (
              <>
                <p className="text-sm text-danger font-medium mb-3">
                  {pingResult.offline} cihaz çevrimdışı ({pingResult.online} çevrimiçi / {pingResult.total} toplam)
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <OfflineList
                    title="Çevrimdışı Switch'ler"
                    items={pingResult.offlineSwitches}
                    emptyText="Çevrimdışı switch yok."
                    onItemClick={(item) => navigate(`/switches?q=${encodeURIComponent(item.name)}`)}
                  />
                  <OfflineList
                    title="Çevrimdışı Envanter Cihazları"
                    items={pingResult.offlineDevices}
                    emptyText="Çevrimdışı envanter cihazı yok."
                    onItemClick={(item) => navigate(`/inventory?q=${encodeURIComponent(item.name)}`)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function OfflineList({
  title,
  items,
  emptyText,
  onItemClick
}: {
  title: string;
  items: OfflineDevice[];
  emptyText: string;
  onItemClick: (item: OfflineDevice) => void;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-secondary mb-2">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-tertiary">{emptyText}</p>
      ) : (
        <motion.ul variants={listVariants} initial="hidden" animate="show" className="space-y-1">
          {items.map((d) => (
            <motion.li
              variants={itemVariants}
              key={d.id}
              className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 cursor-pointer hover:bg-surface-secondary -mx-2 px-2 rounded-md transition-colors duration-150"
              onClick={() => onItemClick(d)}
            >
              <span className="text-sm text-primary">{d.name}</span>
              <span className="text-xs text-tertiary font-mono">{d.ip_address}</span>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

function WarrantyList({
  title,
  items,
  emptyText,
  tone,
  onItemClick
}: {
  title: string;
  items: WarrantyItem[];
  emptyText: string;
  tone: "danger" | "warning";
  onItemClick: (item: WarrantyItem) => void;
}) {
  const toneClass = tone === "danger" ? "text-danger" : "text-warning";

  return (
    <div>
      <h4 className="text-xs font-medium text-secondary mb-2">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-tertiary">{emptyText}</p>
      ) : (
        <motion.ul variants={listVariants} initial="hidden" animate="show" className="space-y-1">
          {items.map((item) => (
            <motion.li
              variants={itemVariants}
              key={item.id}
              className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 cursor-pointer hover:bg-surface-secondary -mx-2 px-2 rounded-md transition-colors duration-150"
              onClick={() => onItemClick(item)}
            >
              <div className="min-w-0">
                <p className="text-sm text-primary truncate">{item.name}</p>
                <p className="text-xs text-tertiary">{formatWarrantyDate(item.warranty_until)}</p>
              </div>
              <span className={`text-xs font-medium shrink-0 ${toneClass}`}>
                {formatDaysRemaining(item.daysRemaining)}
              </span>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

/**
 * Garanti listesinden farklı: tek bir sabit `tone` almaz — her satırın rengi
 * kendi daysRemaining'inden hesaplanır (renewalToneForDays). Böylece "Süresi
 * Dolmuş" listesindeki her satır otomatik danger olur, "Yaklaşan" listesi
 * içindeki satırlar ise ≤14 gün olanlarda danger, kalanında warning —
 * LicenseRenewalBadge'in Lisanslar sayfasındaki iki-kademe mantığıyla aynı.
 */
function LicenseRenewalList({
  title,
  items,
  emptyText,
  onItemClick
}: {
  title: string;
  items: LicenseRenewalItem[];
  emptyText: string;
  onItemClick: (item: LicenseRenewalItem) => void;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-secondary mb-2">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-tertiary">{emptyText}</p>
      ) : (
        <motion.ul variants={listVariants} initial="hidden" animate="show" className="space-y-1">
          {items.map((item) => {
            const toneClass = renewalToneForDays(item.daysRemaining) === "danger" ? "text-danger" : "text-warning";
            return (
              <motion.li
                variants={itemVariants}
                key={item.id}
                className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 cursor-pointer hover:bg-surface-secondary -mx-2 px-2 rounded-md transition-colors duration-150"
                onClick={() => onItemClick(item)}
              >
                <div className="min-w-0">
                  <p className="text-sm text-primary truncate">{item.product_name}</p>
                  <p className="text-xs text-tertiary">{formatRenewalDate(item.renewal_date)}</p>
                </div>
                <span className={`text-xs font-medium shrink-0 ${toneClass}`}>
                  {formatLicenseDaysRemaining(item.daysRemaining)}
                </span>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
