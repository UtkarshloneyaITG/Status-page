import { NO_DATA, STATUS_META } from "@/lib/status";

const ENTRIES = [...Object.values(STATUS_META), NO_DATA];

export default function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
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
  );
}
