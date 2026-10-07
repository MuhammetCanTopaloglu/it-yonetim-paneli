import type { IpAssignmentStatus } from "../types";

const LABELS: Record<IpAssignmentStatus, string> = {
  kullanimda: "Kullanımda",
  bos: "Boş",
  rezerve: "Rezerve"
};

const STYLES: Record<IpAssignmentStatus, string> = {
  kullanimda: "bg-success-soft text-success",
  bos: "bg-surface-secondary text-secondary",
  rezerve: "bg-warning-soft text-warning"
};

export default function IpStatusBadge({ status }: { status: IpAssignmentStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
