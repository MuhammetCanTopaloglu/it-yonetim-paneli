export default function StatCard({
  label,
  value,
  subtitle,
  onClick,
  danger
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`relative text-left rounded-[10px] border bg-surface p-4 transition-all duration-150 ${
        onClick ? "hover:shadow-card hover:-translate-y-0.5 cursor-pointer" : ""
      } ${danger ? "border-l-2 border-l-danger" : ""}`}
    >
      <p className="text-xs font-medium text-secondary mb-1.5">{label}</p>
      <p
        className={`text-[30px] leading-none font-bold tabular-nums ${danger ? "text-danger" : "text-primary"}`}
      >
        {value}
      </p>
      {subtitle && <p className="text-[11px] text-tertiary mt-1.5">{subtitle}</p>}
    </Tag>
  );
}
