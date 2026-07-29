"use client";

import { motion } from "framer-motion";
import type { Indicator } from "@/lib/api";
import { meta } from "@/lib/status";

export default function StatusBanner({
  indicator,
}: {
  indicator: Indicator;
}) {
  const m = meta(indicator.level);
  const isOperational = indicator.level === "operational";

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      aria-live="polite"
      aria-atomic="true"
      className={`relative overflow-hidden rounded-none border p-5 sm:p-6 ${
        isOperational
          ? "border-emerald-200 bg-emerald-50/60 text-slate-900"
          : "border-amber-200 bg-amber-50/60 text-slate-900"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-none bg-white border border-slate-200">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-none font-bold text-white text-base ${m.dot} ${
              isOperational ? "pulse-emerald" : ""
            }`}
          >
            {isOperational ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </span>
        </div>

        <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
          {indicator.text}
        </h2>
      </div>
    </motion.section>
  );
}
