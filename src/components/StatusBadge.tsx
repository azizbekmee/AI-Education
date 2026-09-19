import { CheckCircle2, CircleDashed, Clock3 } from "lucide-react";

export type AssignmentStatus = "completed" | "in_progress" | "not_started";

const STATUS_META: Record<
  AssignmentStatus,
  { label: string; icon: typeof CheckCircle2; classes: string }
> = {
  completed: {
    label: "Bajarilgan",
    icon: CheckCircle2,
    classes: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
  in_progress: {
    label: "Davom ettirilmoqda",
    icon: Clock3,
    classes: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
  not_started: {
    label: "Bajarilmagan",
    icon: CircleDashed,
    classes: "border-red-400/30 bg-red-500/10 text-red-200",
  },
};

export function statusLabel(status: AssignmentStatus): string {
  return STATUS_META[status].label;
}

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {meta.label}
    </span>
  );
}
