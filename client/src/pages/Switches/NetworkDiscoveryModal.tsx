import { useState, type FormEvent } from "react";
import type { DiscoveredDevice } from "../../types";
import { discoverSnmpDevices } from "../../api/snmp";
import { createSwitch } from "../../api/switches";
import Modal from "../../components/Modal";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

/**
 * Ağ keşfi: aralıktaki IP'lere SNMP sorgusu atıp cevap verenleri LİSTELER.
 * OTOMATİK EKLEMEZ — kullanıcı listeden seçtiklerini "Seçilenleri Ekle" ile
 * mevcut switch oluşturma akışına (POST /api/switches) yönlendirir. Zaten
 * kayıtlı bir management_ip'ye denk gelen sonuçlar işaretlenip checkbox'ı
 * kapatılır — mükerrer kayıt önlenir.
 */
export default function NetworkDiscoveryModal({
  existingIps,
  onClose,
  onAdded
}: {
  existingIps: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [ipRange, setIpRange] = useState("");
  const [community, setCommunity] = useState("");
  const [port, setPort] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DiscoveredDevice[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [adding, setAdding] = useState(false);
  const [addSummary, setAddSummary] = useState<string | null>(null);

  async function handleScan(e: FormEvent) {
    e.preventDefault();
    setScanError(null);
    setScanning(true);
    setDevices(null);
    setAddSummary(null);
    try {
      const result = await discoverSnmpDevices({
        ipRange: ipRange.trim(),
        community: community.trim(),
        port: port.trim() ? Number(port.trim()) : undefined
      });
      setDevices(result.found);
      setSelected(new Set(result.found.filter((d) => !existingIps.has(d.ip)).map((d) => d.ip)));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Tarama başarısız oldu");
    } finally {
      setScanning(false);
    }
  }

  function toggle(ip: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ip)) next.delete(ip);
      else next.add(ip);
      return next;
    });
  }

  async function handleAddSelected() {
    if (!devices) return;
    const toAdd = devices.filter((d) => selected.has(d.ip) && !existingIps.has(d.ip));
    if (toAdd.length === 0) return;

    setAdding(true);
    setAddSummary(null);
    let successCount = 0;
    const failures: string[] = [];

    for (const d of toAdd) {
      try {
        await createSwitch({
          name: d.sysName || d.ip,
          model: d.sysDescr || null,
          management_ip: d.ip,
          port_count: d.ifNumber > 0 ? d.ifNumber : null,
          sfp_count: 0,
          vlans: "",
          location: "",
          is_backbone: 0,
          notes: ""
        });
        successCount++;
      } catch (err) {
        failures.push(`${d.ip}: ${err instanceof Error ? err.message : "eklenemedi"}`);
      }
    }

    setAdding(false);
    setAddSummary(
      failures.length === 0
        ? `${successCount} switch eklendi.`
        : `${successCount} switch eklendi, ${failures.length} başarısız (${failures.join("; ")}).`
    );
    if (successCount > 0) onAdded();
  }

  const selectableCount = devices?.filter((d) => !existingIps.has(d.ip)).length ?? 0;

  return (
    <Modal title="Ağı Tara (SNMP Keşif)" onClose={onClose}>
      <div className="space-y-4">
        <form onSubmit={handleScan} className="space-y-3">
          <div>
            <label className={labelClass}>IP Aralığı</label>
            <input
              type="text"
              value={ipRange}
              onChange={(e) => setIpRange(e.target.value)}
              placeholder="192.168.1.0/24 veya 192.168.1.1-192.168.1.50"
              className={inputClass}
              required
            />
            <p className="text-xs text-tertiary mt-1">
              En fazla 256 IP (ör. /24) taranabilir — daha geniş aralıklar reddedilir.
            </p>
          </div>
          <div>
            <label className={labelClass}>Community String</label>
            <input
              type="text"
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              placeholder="ör. public"
              className={inputClass}
              autoComplete="off"
              required
            />
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

          {scanError && <p className="text-sm text-danger">{scanError}</p>}

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
              disabled={scanning}
              className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {scanning ? "Taranıyor... (birkaç saniye sürebilir)" : "Tara"}
            </button>
          </div>
        </form>

        {devices && (
          <div className="pt-3 border-t">
            {devices.length === 0 ? (
              <p className="text-sm text-tertiary">Aralıkta SNMP'ye cevap veren cihaz bulunamadı.</p>
            ) : (
              <>
                <p className="text-xs text-secondary mb-2">
                  {devices.length} cihaz bulundu, {selectableCount} tanesi eklenebilir.
                </p>
                <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                  {devices.map((d) => {
                    const already = existingIps.has(d.ip);
                    return (
                      <li
                        key={d.ip}
                        className={`flex items-start gap-2.5 p-2 rounded-md border text-sm ${already ? "opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(d.ip)}
                          disabled={already}
                          onChange={() => toggle(d.ip)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary truncate">{d.sysName || "(isimsiz)"}</span>
                            <span className="text-tertiary text-xs shrink-0">{d.ip}</span>
                            {already && (
                              <span className="text-xs text-tertiary shrink-0">— zaten kayıtlı</span>
                            )}
                          </div>
                          <div className="text-xs text-secondary truncate">{d.sysDescr || "—"}</div>
                          <div className="text-xs text-tertiary">{d.ifNumber} port</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {addSummary && <p className="text-sm text-secondary mt-3">{addSummary}</p>}

                {(() => {
                  const addableSelectedCount = devices.filter(
                    (d) => selected.has(d.ip) && !existingIps.has(d.ip)
                  ).length;
                  return (
                    <div className="flex justify-end gap-2 pt-3">
                      <button
                        onClick={handleAddSelected}
                        disabled={adding || addableSelectedCount === 0}
                        className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                      >
                        {adding ? "Ekleniyor..." : `Seçilenleri Ekle (${addableSelectedCount})`}
                      </button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
