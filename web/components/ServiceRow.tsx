"use client";

import { motion } from "framer-motion";
import type { Service } from "@/lib/api";
import { meta } from "@/lib/status";
import UptimeBar from "./UptimeBar";

function getServiceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("webhook")) {
    return (
      <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  if (lower.includes("graphql") || lower.includes("api")) {
    return (
      <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (lower.includes("mobile") || lower.includes("app")) {
    return (
      <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
    </svg>
  );
}

export default function ServiceRow({ service }: { service: Service }) {
  const m = meta(service.status);
  const icon = getServiceIcon(service.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="group/card rounded-none border border-slate-200 bg-white p-5 transition-colors duration-200 hover:border-slate-300"
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-indigo-50 border border-indigo-100">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm sm:text-base group-hover/card:text-indigo-600 transition-colors">
                {service.name}
              </span>
            </div>
            {service.description && (
              <p className="text-xs text-slate-500 line-clamp-1">
                {service.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${m.text}`}>
            <span aria-hidden="true">{m.icon}</span>
            {m.label}
          </span>
        </div>
      </div>

      <UptimeBar days={service.days} serviceName={service.name} />

      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-400">
        <span>90 Days Ago</span>
        <span className="rounded-none bg-slate-100 px-2.5 py-0.5 text-slate-700 font-bold border border-slate-200/60">
          {service.uptime_percent === null
            ? "No data"
            : `${service.uptime_percent.toFixed(2)}% Uptime`}
        </span>
        <span className="text-slate-500 font-bold">Today</span>
      </div>
    </motion.div>
  );
}
