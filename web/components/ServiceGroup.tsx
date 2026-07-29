import type { Group } from "@/lib/api";
import ServiceRow from "./ServiceRow";

// Native <details> collapses without JavaScript and is keyboard accessible
// for free — no state, no aria-expanded to keep in sync.
export default function ServiceGroup({ group }: { group: Group }) {
  return (
    <details
      open
      className="border-b border-slate-200 py-2 last:border-0 dark:border-slate-800"
    >
      <summary className="cursor-pointer py-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {group.name}
      </summary>
      <div className="pl-1">
        {group.services.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
      </div>
    </details>
  );
}
