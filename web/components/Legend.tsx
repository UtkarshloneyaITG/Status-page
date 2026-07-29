"use client";

import { motion } from "framer-motion";
import { NO_DATA, STATUS_META } from "@/lib/status";

const EXPLANATIONS: Record<string, string> = {
  Operational: "All core systems and features functioning normally",
  "Degraded Performance": "Service is working with minor latency or slowness",
  "Partial Outage": "Certain core functionality or endpoints unavailable",
  "Major Outage": "Service is completely unavailable to users",
  Maintenance: "Planned maintenance or scheduled system update in progress",
  "No data": "Insufficient telemetry or status history logged",
};

const ENTRIES = [...Object.values(STATUS_META), NO_DATA];

export default function Legend() {
  return (
    <div className="rounded-none border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Status Definitions & Legend
        </h3>
        <span className="text-[11px] font-semibold text-slate-400">WCAG AA Accessible</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {ENTRIES.map((m, idx) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.04 }}
            className="flex items-start gap-2.5 rounded-none border border-slate-200/80 bg-slate-50/60 p-3 text-xs transition-colors hover:bg-slate-100/70"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-none ${m.dot}`}
            />
            <div>
              <span className="font-bold text-slate-900 block leading-tight">
                {m.label}
              </span>
              <span className="text-[11px] text-slate-500 leading-normal block mt-0.5">
                {EXPLANATIONS[m.label] ?? "Status indicator"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
