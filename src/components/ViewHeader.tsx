import type { LucideIcon } from "lucide-react";

export function ViewHeader({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="view-header">
      <div>
        <Icon size={20} />
        <strong>{label}</strong>
      </div>
      <span>{value}</span>
    </div>
  );
}

