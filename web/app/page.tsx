import Link from "next/link";

import ReportDrawer from "@/components/ReportDrawer";
// Restore alongside the commented-out status sections below.
// import Legend from "@/components/Legend";
// import ServiceGroup from "@/components/ServiceGroup";
// import ServiceRow from "@/components/ServiceRow";
// import StatusBanner from "@/components/StatusBanner";
import { allServices, getSummary } from "@/lib/api";
import { getPublicFeedback } from "@/lib/feedback";

export default async function Page() {
  const [summary, feedback] = await Promise.all([
    getSummary(),
    getPublicFeedback(),
  ]);

  if (!summary) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <section
          aria-live="polite"
          className="flex items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 px-6 py-6 dark:border-amber-800 dark:bg-amber-950"
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-lg font-bold text-white"
          >
            !
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Status unavailable
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              We can&apos;t reach the status service right now. This page will
              recover on its own once it&apos;s back.
            </p>
          </div>
        </section>
      </main>
    );
  }

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

      {/* Global status banner — hidden for now, alongside the service list. */}
      {/* <StatusBanner indicator={summary.indicator} /> */}

      {/* Service list and legend — hidden for now. Uncomment to restore;
          the API still returns everything these need. */}
      {/*
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
      */}

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
