import type { Indicator } from "@/lib/api";
import { meta } from "@/lib/status";

export default function StatusBanner({ indicator }: { indicator: Indicator }) {
  const m = meta(indicator.level);
  const isOperational = indicator.level === "operational";

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className={`relative overflow-hidden flex items-center justify-between gap-4 rounded-2xl border ${
        isOperational
          ? "border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/30"
          : "border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/30"
      } p-6 sm:p-7 shadow-xs`}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center">
          <span
            aria-hidden="true"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-sm ${m.dot} ${
              isOperational ? "pulse-emerald" : ""
            }`}
          >
            {m.icon}
          </span>
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            System Overview
          </span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight sm:text-2xl">
            {indicator.text}
          </h1>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
        <span className={`h-2 w-2 rounded-full ${m.dot}`} />
        <span>Live Status</span>
      </div>
    </section>
  );
}
