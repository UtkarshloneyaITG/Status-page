"use client";

import { motion } from "framer-motion";
import type { Day } from "@/lib/api";
import { isNotable, meta } from "@/lib/status";

function describe(day: Day): string {
  const m = meta(day.status);
  const pct =
    day.uptime === null ? "No uptime data" : `${day.uptime.toFixed(2)}% uptime`;
  return `${day.date}: ${m.label} (${pct})`;
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
      <div aria-hidden="true" className="flex h-7 items-stretch gap-1">
        {days.map((day, idx) => {
          const m = meta(day.status);
          const isToday = idx === days.length - 1;
          const isNearRight = idx > 70;
          const isNearLeft = idx < 15;

          const positionClass = isNearRight
            ? "right-0 mb-2"
            : isNearLeft
            ? "left-0 mb-2"
            : "left-1/2 -translate-x-1/2 mb-2";

          const segment = (
            <motion.span
              whileHover={{ scaleY: 1.25 }}
              transition={{ duration: 0.15 }}
              className={`block h-full w-full rounded-none transition-colors ${m.bar} ${
                isToday ? "ring-2 ring-indigo-500/80 ring-offset-1" : ""
              }`}
            />
          );

          const tooltip = (
            <span
              className={`pointer-events-none absolute bottom-full ${positionClass} z-30 hidden group-hover/bar:flex group-hover/bar:flex-col group-focus/bar:flex group-focus/bar:flex-col w-max max-w-xs rounded-none bg-slate-900 px-3 py-2 text-[11px] font-medium text-white backdrop-blur-md border border-slate-700/80`}
            >
              <span className="font-bold text-slate-200">
                {day.date} {isToday ? "(Today)" : ""}
              </span>
              <span className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                <span className={`h-2 w-2 rounded-none ${m.dot}`} />
                <span className="text-slate-100">{m.label}</span>
                <span className="text-slate-400 font-semibold">
                  • {day.uptime === null ? "N/A" : `${day.uptime.toFixed(2)}%`}
                </span>
              </span>
            </span>
          );

          return isNotable(day.status) ? (
            <button
              key={day.date}
              type="button"
              tabIndex={0}
              className="group/bar relative flex-1 cursor-default outline-none"
            >
              {segment}
              {tooltip}
            </button>
          ) : (
            <span
              key={day.date}
              className="group/bar relative flex-1"
            >
              {segment}
              {tooltip}
            </span>
          );
        })}
      </div>

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
