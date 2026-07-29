"use client";

import { motion } from "framer-motion";
import { meta } from "@/lib/status";

type MetricsGridProps = {
  indicatorLevel: string;
  indicatorText: string;
  totalServices: number;
  operationalServices: number;
  uptimePercent?: number;
  activeIncidentsCount?: number;
};

export default function MetricsGrid({
  indicatorLevel,
  indicatorText,
  totalServices,
  operationalServices,
  uptimePercent = 99.98,
  activeIncidentsCount = 0,
}: MetricsGridProps) {
  const m = meta(indicatorLevel);

  const cards = [
    {
      id: "status",
      title: "Overall Health",
      value: m.label,
      subtitle: indicatorText,
      badgeColor: m.text,
      iconSvg: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "uptime",
      title: "90-Day Uptime",
      value: `${uptimePercent}%`,
      subtitle: "Rolling historical availability",
      badgeColor: "text-emerald-700 bg-emerald-50 border-emerald-200/60",
      iconSvg: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      id: "services",
      title: "Infrastructure",
      value: `${totalServices} Total`,
      subtitle: `${operationalServices} of ${totalServices} operational`,
      badgeColor: "text-indigo-700 bg-indigo-50 border-indigo-200/60",
      iconSvg: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
        </svg>
      ),
    },
    {
      id: "incidents",
      title: "Active Incidents",
      value: `${activeIncidentsCount} Active`,
      subtitle: activeIncidentsCount === 0 ? "All systems normal" : "Action required",
      badgeColor: activeIncidentsCount === 0 ? "text-slate-600 bg-slate-100 border-slate-200" : "text-amber-700 bg-amber-50 border-amber-200/60",
      iconSvg: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, idx) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.08 }}
          className="card-hover-effect flex flex-col justify-between rounded-none border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {c.title}
            </span>
            <div className={`flex h-9 w-9 items-center justify-center rounded-none border ${c.badgeColor}`}>
              {c.iconSvg}
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {c.value}
            </div>
            <p className="mt-1 text-xs text-slate-500 truncate">
              {c.subtitle}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
