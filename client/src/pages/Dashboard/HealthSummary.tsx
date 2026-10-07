import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePingStatus } from "../../ping/PingStatusProvider";
import type { DashboardData } from "../../types";

type Severity = "danger" | "warning";

interface HealthIssue {
  key: string;
  severity: Severity;
  text: string;
  onClick: () => void;
}

/**
 * Ağ Sağlığı özeti mevcut tüm verileri (ping, garanti, arızalı envanter,
 * kritik görevler) TEK bir görünümde birleştirir — yeni bir veri kaynağı
 * yok, hepsi zaten dashboard'da veya paylaşılan ping context'inde var.
 *
 * Kategorik durum (iyi/dikkat/kritik) + somut madde listesi kullanıyoruz,
 * tek bir 0-100 "skor" DEĞİL — bir skor burada sahte kesinlik verir (ör.
 * "72" ne anlama geliyor?), oysa "3 şeye dikkat" listesi doğrudan
 * eyleme dönüştürülebilir.
 *
 * Öncelik sırası (en kritikten en aza, sabit): çevrimdışı switch > kritik
 * görevler (gecikmiş öncelikli) > arızalı envanter > garantisi dolmuş >
 * çevrimdışı envanter cihazı > garantisi yaklaşan. Ping henüz hiç
 * çalıştırılmadıysa (pingResult null) ağ ile ilgili maddeler LİSTEYE
 * EKLENMEZ — "her şey çevrimdışı" gibi yanlış bir izlenim vermemek için
 * ayrı, nötr bir bilgi notuyla gösterilir.
 */
export default function HealthSummary({ data }: { data: DashboardData }) {
  const navigate = useNavigate();
  const { result: pingResult, loading: pingLoading, runCheck } = usePingStatus();

  const issues = useMemo<HealthIssue[]>(() => {
    const list: HealthIssue[] = [];

    if (pingResult && pingResult.offlineSwitches.length > 0) {
      list.push({
        key: "offline-switches",
        severity: "danger",
        text: `${pingResult.offlineSwitches.length} switch çevrimdışı`,
        onClick: () => navigate("/switches")
      });
    }

    if (data.criticalTodos.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const hasOverdue = data.criticalTodos.some((t) => t.due_date && t.due_date < today);
      list.push({
        key: "critical-todos",
        severity: hasOverdue ? "danger" : "warning",
        text: hasOverdue
          ? `${data.criticalTodos.length} kritik görev (gecikmiş dahil)`
          : `${data.criticalTodos.length} yüksek öncelikli açık görev`,
        onClick: () => navigate("/todo")
      });
    }

    if (data.counts.faultyInventory > 0) {
      list.push({
        key: "faulty-inventory",
        severity: "danger",
        text: `${data.counts.faultyInventory} cihaz arızalı`,
        onClick: () => navigate("/inventory?status=arizali")
      });
    }

    if (data.warranty.expired.length > 0) {
      list.push({
        key: "warranty-expired",
        severity: "danger",
        text: `${data.warranty.expired.length} cihazın garantisi dolmuş`,
        onClick: () => navigate("/inventory")
      });
    }

    if (data.licenseRenewal.expired.length > 0) {
      list.push({
        key: "license-expired",
        severity: "danger",
        text: `${data.licenseRenewal.expired.length} lisansın yenileme tarihi geçti`,
        onClick: () => navigate("/licenses")
      });
    }

    const licenseUrgent = data.licenseRenewal.upcoming.filter((l) => l.daysRemaining <= 14);
    if (licenseUrgent.length > 0) {
      list.push({
        key: "license-urgent",
        severity: "danger",
        text: `${licenseUrgent.length} lisansın yenilemesi acil (14 gün içinde)`,
        onClick: () => navigate("/licenses")
      });
    }

    if (pingResult && pingResult.offlineDevices.length > 0) {
      list.push({
        key: "offline-inventory",
        severity: "warning",
        text: `${pingResult.offlineDevices.length} envanter cihazı çevrimdışı`,
        onClick: () => navigate("/inventory")
      });
    }

    if (data.warranty.upcoming.length > 0) {
      list.push({
        key: "warranty-upcoming",
        severity: "warning",
        text: `${data.warranty.upcoming.length} cihazın garantisi yakında doluyor`,
        onClick: () => navigate("/inventory")
      });
    }

    const licenseUpcomingOnly = data.licenseRenewal.upcoming.filter((l) => l.daysRemaining > 14);
    if (licenseUpcomingOnly.length > 0) {
      list.push({
        key: "license-upcoming",
        severity: "warning",
        text: `${licenseUpcomingOnly.length} lisansın yenileme tarihi yaklaşıyor`,
        onClick: () => navigate("/licenses")
      });
    }

    return list;
  }, [data, pingResult, navigate]);

  const criticalCount = issues.filter((i) => i.severity === "danger").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const status: "good" | "attention" | "critical" =
    criticalCount > 0 ? "critical" : warningCount > 0 ? "attention" : "good";

  const statusLabel =
    status === "critical"
      ? `${issues.length} konuya dikkat (${criticalCount} kritik)`
      : status === "attention"
        ? `${warningCount} konuya dikkat`
        : "Her şey yolunda";

  const dotClass = status === "critical" ? "bg-danger" : status === "attention" ? "bg-warning" : "bg-success";
  const textClass = status === "critical" ? "text-danger" : status === "attention" ? "text-warning" : "text-success";

  return (
    <section className="rounded-xl border bg-surface p-5 shadow-panel mb-6">
      <div className="flex items-center gap-2.5 mb-1">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
        <h3 className="font-semibold text-primary">Ağ Sağlığı</h3>
        <span className={`text-sm font-medium ${textClass}`}>{statusLabel}</span>
      </div>

      {pingResult === null && (
        <p className="text-xs text-tertiary mt-1 mb-1">
          Ağ durumu (çevrimdışı switch/cihaz) için henüz kontrol yapılmadı, bu özete dahil değil.{" "}
          <button
            onClick={runCheck}
            disabled={pingLoading}
            className="text-accent hover:underline disabled:opacity-50"
          >
            {pingLoading ? "Kontrol ediliyor..." : "Şimdi Kontrol Et"}
          </button>
        </p>
      )}

      {issues.length === 0 ? (
        <p className="text-sm text-success mt-2">✓ Dikkat edilmesi gereken bir konu yok.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {issues.map((issue) => (
            <li key={issue.key}>
              <button
                onClick={issue.onClick}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 hover:brightness-95 ${
                  issue.severity === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
                }`}
              >
                {issue.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
