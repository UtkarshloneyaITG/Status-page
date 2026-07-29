import Legend from "@/components/Legend";
import ServiceGroup from "@/components/ServiceGroup";
import ServiceRow from "@/components/ServiceRow";
import StatusBanner from "@/components/StatusBanner";
import { getSummary } from "@/lib/api";

export default async function Page() {
  const summary = await getSummary();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400">
        {summary.product_name}
      </p>

      <StatusBanner indicator={summary.indicator} />

      <section
        aria-label="Services"
        className="mt-10 rounded-xl border border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900"
      >
        {summary.groups.map((group) => (
          <ServiceGroup key={group.id} group={group} />
        ))}
        {summary.ungrouped.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
      </section>

      <div className="mt-6">
        <Legend />
      </div>

      <p className="mt-10 text-xs text-slate-400 dark:text-slate-600">
        Updated{" "}
        <time dateTime={summary.updated_at}>
          {new Date(summary.updated_at).toUTCString()}
        </time>
      </p>
    </main>
  );
}
