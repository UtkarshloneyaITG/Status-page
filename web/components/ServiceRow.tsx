import type { Service } from "@/lib/api";
import { meta } from "@/lib/status";
import UptimeBar from "./UptimeBar";

export default function ServiceRow({ service }: { service: Service }) {
  const m = meta(service.status);
  return (
    <div className="border-b border-slate-200 py-5 last:border-0 dark:border-slate-800">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-medium">{service.name}</span>
        <span className={`flex items-center gap-1.5 text-sm ${m.text}`}>
          <span aria-hidden="true">{m.icon}</span>
          {m.label}
        </span>
      </div>

      <UptimeBar days={service.days} serviceName={service.name} />

      <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{service.days.length} days ago</span>
        <span>
          {service.uptime_percent === null
            ? "No data"
            : `${service.uptime_percent.toFixed(2)}% uptime`}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
