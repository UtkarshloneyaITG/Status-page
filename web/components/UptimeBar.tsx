import type { Day } from "@/lib/api";
import { isNotable, meta } from "@/lib/status";

function describe(day: Day): string {
  const m = meta(day.status);
  const pct =
    day.uptime === null ? "no uptime data" : `${day.uptime.toFixed(2)}% uptime`;
  return `${day.date}: ${m.label}, ${pct}`;
}

export default function UptimeBar({
  days,
  serviceName,
}: {
  days: Day[];
  serviceName: string;
}) {
  const notable = days.filter((d) => isNotable(d.status));

  return (
    <div>
      <div aria-hidden="true" className="flex h-8 items-stretch gap-[2px]">
        {days.map((day) => {
          const segment = (
            <span
              className={`block h-full w-full rounded-full ${meta(day.status).bar}`}
            />
          );
          const tooltip = (
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block group-focus:block mb-1.5">
              {describe(day)}
            </span>
          );

          // ponytail: only days where something happened are focusable. Making
          // all 90 focusable per service would put ~540 tab stops on the page
          // for information the screen-reader summary below already carries.
          return isNotable(day.status) ? (
            <button
              key={day.date}
              type="button"
              tabIndex={0}
              className="group relative min-w-[2px] flex-1 cursor-default rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100"
            >
              {segment}
              {tooltip}
            </button>
          ) : (
            <span
              key={day.date}
              className="group relative min-w-[2px] flex-1 rounded-full"
            >
              {segment}
              {tooltip}
            </span>
          );
        })}
      </div>

      {/* The same information the tooltips carry, in reading order. */}
      <p className="sr-only">
        {serviceName}: {days.length}-day history.{" "}
        {notable.length === 0
          ? "Operational every day."
          : `${notable.length} day${notable.length === 1 ? "" : "s"} not fully operational: ${notable
              .map(describe)
              .join("; ")}.`}
      </p>
    </div>
  );
}
