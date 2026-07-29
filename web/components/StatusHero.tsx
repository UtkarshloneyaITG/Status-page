"use client";

import { motion } from "framer-motion";
import ReportDrawer from "./ReportDrawer";

type Option = { id: string; name: string };

export default function StatusHero({
  productName = "System",
  services,
}: {
  productName?: string;
  services: Option[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Status Monitor
          </span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          {productName} Systems Status
        </h1>
      </div>

      <div className="shrink-0 pt-2 sm:pt-0">
        <ReportDrawer services={services} />
      </div>
    </motion.div>
  );
}
