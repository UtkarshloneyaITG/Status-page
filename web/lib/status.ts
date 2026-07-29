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
    text: "text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full",
    icon: "✓",
  },
  degraded_performance: {
    label: "Degraded Performance",
    dot: "bg-amber-500",
    bar: "bg-amber-400",
    text: "text-amber-700 font-semibold bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-full",
    icon: "!",
  },
  partial_outage: {
    label: "Partial Outage",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    text: "text-orange-700 font-semibold bg-orange-50 border border-orange-200/60 px-2.5 py-0.5 rounded-full",
    icon: "▲",
  },
  major_outage: {
    label: "Major Outage",
    dot: "bg-red-500",
    bar: "bg-red-500",
    text: "text-red-700 font-semibold bg-red-50 border border-red-200/60 px-2.5 py-0.5 rounded-full",
    icon: "✕",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
    text: "text-blue-700 font-semibold bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full",
    icon: "⚙",
  },
};

export const NO_DATA: StatusMeta = {
  label: "No data",
  dot: "bg-slate-300",
  bar: "bg-slate-200",
  text: "text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full",
  icon: "–",
};

export function meta(status: string | null): StatusMeta {
  return (status && STATUS_META[status]) || NO_DATA;
}

/** A day worth drawing attention to: an outage, maintenance, or a gap. */
export function isNotable(status: string | null): boolean {
  return status !== "operational";
}
