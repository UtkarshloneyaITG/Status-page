import Link from "next/link";

import Legend from "@/components/Legend";
import ReportDrawer from "@/components/ReportDrawer";
import ServiceGroup from "@/components/ServiceGroup";
import ServiceRow from "@/components/ServiceRow";
import StatusBanner from "@/components/StatusBanner";
import { allServices, getSummary } from "@/lib/api";
import { getPublicFeedback } from "@/lib/feedback";

export default async function Page() {
  const [summary, feedback] = await Promise.all([
    getSummary(),
    getPublicFeedback(),
  ]);
  const services = allServices(summary).map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {summary.product_name}
        </p>
        <ReportDrawer services={services} />
      </div>

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

      <section
        aria-labelledby="log-heading"
        className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <h2 id="log-heading" className="font-semibold">
            Reported and resolved
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {feedback.length === 0
              ? "Nothing published yet."
              : `${feedback.length} ${feedback.length === 1 ? "report" : "reports"} people told us about, and what we did.`}
          </p>
        </div>
        <Link
          href="/reports"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          View the log
        </Link>
      </section>

      <p className="mt-10 text-xs text-slate-400 dark:text-slate-600">
        Updated{" "}
        <time dateTime={summary.updated_at}>
          {new Date(summary.updated_at).toUTCString()}
        </time>
      </p>
    </main>
  );
}
