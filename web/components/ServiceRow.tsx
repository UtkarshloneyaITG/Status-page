import type { Service } from "@/lib/api";
import { meta } from "@/lib/status";
import UptimeBar from "./UptimeBar";

export default function ServiceRow({ service }: { service: Service }) {
  const m = meta(service.status);
  return (
    <div className="border-b border-slate-100 py-5 last:border-0 hover:bg-slate-50/50 transition-colors px-3 rounded-lg">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 text-sm sm:text-base">
            {service.name}
          </span>
          {service.description && (
            <span className="text-xs text-slate-500 hidden sm:inline">
              – {service.description}
            </span>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs ${m.text}`}>
          <span aria-hidden="true">{m.icon}</span>
          {m.label}
        </span>
      </div>

      <UptimeBar days={service.days} serviceName={service.name} />

      <div className="mt-2.5 flex justify-between text-[11px] font-medium text-slate-400">
        <span>{service.days.length} days ago</span>
        <span className="text-slate-600 font-semibold">
          {service.uptime_percent === null
            ? "No data"
            : `${service.uptime_percent.toFixed(2)}% uptime`}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
