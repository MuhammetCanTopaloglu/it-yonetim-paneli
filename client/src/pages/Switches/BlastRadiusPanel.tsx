import { useNavigate } from "react-router-dom";
import type { BlastRadiusResult } from "../../types";
import Modal from "../../components/Modal";

/**
 * Etki analizi sonuç paneli — GET /api/switches/:id/blast-radius sonucunu
 * gösterir. Salt gösterim, DB'ye hiçbir şey yazmaz. Liste öğelerine tıklamak
 * ilgili kayda gider (Detay/Kart sekmesinde arama ile) — mevcut
 * HealthSummary.tsx'teki "tıkla, navigate et" deseniyle aynı.
 */
export default function BlastRadiusPanel({
  targetName,
  result,
  onClose
}: {
  targetName: string;
  result: BlastRadiusResult;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  function goToSwitch(name: string) {
    onClose();
    navigate(`/switches?q=${encodeURIComponent(name)}`);
  }

  function goToInventory(name: string) {
    onClose();
    navigate(`/inventory?q=${encodeURIComponent(name)}`);
  }

  const otherAffectedSwitches = result.affectedSwitches.filter((s) => s.id !== result.targetId);

  if (!result.hasBackbone) {
    return (
      <Modal title="Etki Analizi" onClose={onClose}>
        <p className="text-sm text-secondary">
          Önce en az bir switch'i omurga olarak işaretleyin (switch düzenle → "Omurga switch"). Omurga
          işaretlenmeden etki analizi yapılamaz.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title={`Etki Analizi — ${targetName}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="font-medium text-primary">
            {targetName} düşerse: {otherAffectedSwitches.length} switch, {result.affectedInventory.length} cihaz
            etkilenir
          </p>

          {!result.targetWasReachable && (
            <p className="text-sm text-tertiary mt-1">Bu switch zaten omurgaya bağlı değil.</p>
          )}

          {result.targetWasReachable && result.isBackboneTarget && result.remainingBackboneCount === 0 && (
            <p className="text-sm text-danger mt-1">
              Bu switch tek/son omurga — düşerse omurga tamamen kaybolur, ağdaki HER switch etkilenir.
            </p>
          )}

          {result.targetWasReachable && !result.critical && (
            <p className="text-sm text-success mt-1">
              Bu switch kritik değil — düşse bile ağ erişimi başka yoldan korunur.
            </p>
          )}
        </div>

        {otherAffectedSwitches.length > 0 && (
          <div>
            <p className="text-xs font-medium text-secondary mb-1.5">Etkilenen Switch'ler</p>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {otherAffectedSwitches.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => goToSwitch(s.name)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md text-sm bg-danger-soft text-danger hover:brightness-95 transition-colors duration-150"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.affectedInventory.length > 0 && (
          <div>
            <p className="text-xs font-medium text-secondary mb-1.5">Etkilenen Envanter Cihazları</p>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {result.affectedInventory.map((inv) => (
                <li key={inv.id}>
                  <button
                    onClick={() => goToInventory(inv.name)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md text-sm bg-warning-soft text-warning hover:brightness-95 transition-colors duration-150"
                  >
                    {inv.name} <span className="text-tertiary">({inv.switchName} üzerinden)</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary">
            Kapat
          </button>
        </div>
      </div>
    </Modal>
  );
}
