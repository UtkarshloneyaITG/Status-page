export type StatusMeta = {
  label: string;
  dot: string;
  bar: string;
  text: string;
  icon: string;
};

// Every status carries an icon and a label. Color is never the only signal.
// Class strings are written out in full because Tailwind only sees literals.
export const STATUS_META: Record<string, StatusMeta> = {
  operational: {
    label: "Operational",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: "✓",
  },
  degraded_performance: {
    label: "Degraded Performance",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
    text: "text-amber-700 dark:text-amber-400",
    icon: "!",
  },
  partial_outage: {
    label: "Partial Outage",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
    icon: "▲",
  },
  major_outage: {
    label: "Major Outage",
    dot: "bg-red-600",
    bar: "bg-red-600",
    text: "text-red-700 dark:text-red-400",
    icon: "✕",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    icon: "⚙",
  },
};

export const NO_DATA: StatusMeta = {
  label: "No data",
  dot: "bg-slate-300 dark:bg-slate-700",
  bar: "bg-slate-200 dark:bg-slate-700",
  text: "text-slate-500 dark:text-slate-400",
  icon: "–",
};

export function meta(status: string | null): StatusMeta {
  return (status && STATUS_META[status]) || NO_DATA;
}

/** A day worth drawing attention to: an outage, maintenance, or a gap. */
export function isNotable(status: string | null): boolean {
  return status !== "operational";
}
