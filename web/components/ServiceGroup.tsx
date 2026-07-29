import type { Group } from "@/lib/api";
import ServiceRow from "./ServiceRow";

// Native <details> collapses without JavaScript and is keyboard accessible
// for free — no state, no aria-expanded to keep in sync.
export default function ServiceGroup({ group }: { group: Group }) {
  return (
    <details
      open
      className="border-b border-slate-200 py-3 last:border-0 group"
    >
      <summary className="cursor-pointer py-2.5 text-xs font-bold tracking-wider text-slate-500 uppercase hover:text-slate-800 transition-colors flex items-center justify-between">
        <span>{group.name}</span>
        <span className="text-slate-400 text-xs font-normal transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className="pt-1 space-y-1">
        {group.services.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
      </div>
    </details>
  );
}
