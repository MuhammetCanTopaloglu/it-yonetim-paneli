import { useState, type FormEvent } from "react";
import type { Switch, SnmpQueryResult } from "../../types";
import { querySnmpDevice } from "../../api/snmp";
import Modal from "../../components/Modal";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

const OPER_STATUS_LABEL: Record<string, string> = {
  up: "Up",
  down: "Down",
  testing: "Test",
  dormant: "Dormant",
  notPresent: "Yok",
  lowerLayerDown: "Alt katman kapalı",
  unknown: "Bilinmiyor"
};

function operStatusClass(status: string): string {
  if (status === "up") return "bg-success-soft text-success";
  if (status === "down") return "bg-danger-soft text-danger";
  return "bg-surface-secondary text-tertiary";
}

/**
 * Community string sunucudan İSTEMCİYE HİÇ GÖNDERİLMEZ (bkz. backend
 * SWITCH_PUBLIC_COLUMNS) — bu yüzden burada "kayıtlı değeri göster/maskele"
 * diye bir seçenek YOK, çünkü frontend'in gösterecek bir değeri yok. Alan
 * her zaman boş başlar; boş bırakılırsa backend switchId üzerinden kayıtlı
 * community'ye (varsa) kendi içinde düşer. Kullanıcının bu formda elle
 * girdiği community, submit dışında hiçbir yere (konsol/localStorage) yazılmaz.
 */
export default function SnmpQueryModal({ item, onClose }: { item: Switch; onClose: () => void }) {
  const [community, setCommunity] = useState("");
  const [port, setPort] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SnmpQueryResult | null>(null);

  const ip = item.management_ip ?? "";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await querySnmpDevice({
        ip,
        switchId: item.id,
        community: community.trim() || undefined,
        port: port.trim() ? Number(port.trim()) : undefined
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sorgu başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`SNMP Sorgusu — ${item.name}`} onClose={onClose}>
      {!ip ? (
        <p className="text-sm text-danger">
          Bu switch'in kayıtlı bir yönetim IP'si yok. Önce switch kaydını düzenleyip IP girin.
        </p>
      ) : (
        <>
          {!result && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <span className={labelClass}>Hedef IP</span>
                <p className="text-sm text-primary">{ip}</p>
              </div>
              <div>
                <label className={labelClass}>Community String</label>
                <input
                  type="text"
                  value={community}
                  onChange={(e) => setCommunity(e.target.value)}
                  placeholder="Kayıtlıysa boş bırakabilirsiniz"
                  className={inputClass}
                  autoComplete="off"
                />
                <p className="text-xs text-tertiary mt-1">
                  Bu switch için sunucuda kayıtlı bir community string varsa (güvenlik nedeniyle burada
                  gösterilmez), boş bırakırsanız o kullanılır. Girerseniz sadece bu sorgu için geçerli olur.
                </p>
              </div>
              <div>
                <label className={labelClass}>Port (opsiyonel)</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="161"
                  className={inputClass}
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {loading ? "Sorgulanıyor..." : "Sorgula"}
                </button>
              </div>
            </form>
          )}

          {result && (
            <div className="space-y-3">
              <dl className="text-sm space-y-1.5 text-secondary">
                <div className="flex justify-between">
                  <dt className="text-tertiary">Cihaz Adı</dt>
                  <dd className="text-primary font-medium">{result.sysName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-tertiary shrink-0">Açıklama</dt>
                  <dd className="text-right break-words">{result.sysDescr || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tertiary">Açık Kalma Süresi</dt>
                  <dd>{result.sysUpTime.formatted}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-tertiary">Port Sayısı</dt>
                  <dd>{result.ifNumber}</dd>
                </div>
              </dl>

              {result.interfaces.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-secondary mb-2">Port Durumu</p>
                  <ul className="space-y-1 max-h-64 overflow-y-auto">
                    {result.interfaces.map((iface) => (
                      <li key={iface.index} className="flex items-center justify-between text-sm">
                        <span className="text-secondary truncate">{iface.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${operStatusClass(iface.operStatus)}`}
                        >
                          {OPER_STATUS_LABEL[iface.operStatus] ?? iface.operStatus}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  onClick={() => setResult(null)}
                  className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
                >
                  Tekrar Sorgula
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
                >
                  Kapat
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
