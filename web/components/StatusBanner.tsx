import type { Indicator } from "@/lib/api";
import { meta } from "@/lib/status";

export default function StatusBanner({ indicator }: { indicator: Indicator }) {
  const m = meta(indicator.level);
  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${m.dot}`}
      >
        {m.icon}
      </span>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {indicator.text}
      </h1>
    </section>
  );
}
