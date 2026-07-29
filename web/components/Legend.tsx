import { NO_DATA, STATUS_META } from "@/lib/status";

const ENTRIES = [...Object.values(STATUS_META), NO_DATA];

export default function Legend() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Status Legend
      </p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-600">
        {ENTRIES.map((m) => (
          <li key={m.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${m.dot}`}
            />
            {m.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
