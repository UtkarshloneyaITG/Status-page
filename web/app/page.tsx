import Link from "next/link";

import Legend from "@/components/Legend";
import ReportDrawer from "@/components/ReportDrawer";
import ServiceGroup from "@/components/ServiceGroup";
import ServiceRow from "@/components/ServiceRow";
import StatusBanner from "@/components/StatusBanner";
import { allServices, getSummary } from "@/lib/api";
import { getPublicFeedback } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [summary, feedback] = await Promise.all([
    getSummary(),
    getPublicFeedback(),
  ]);

  if (!summary) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <section
          aria-live="polite"
          className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-6 sm:p-8 shadow-xs"
        >
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xl font-bold text-white shadow-xs"
          >
            !
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Status Service Currently Unavailable
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              We cannot reach the live status service right now. This page will automatically update once connection is restored.
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
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {summary.product_name} Services
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Real-time status monitor across all systems
          </p>
        </div>
        <ReportDrawer services={services} />
      </div>

      {/* Global Status Banner — hidden */}
      {/* <StatusBanner indicator={summary.indicator} /> */}

      {/* Service List Section & Legend — hidden */}
      {/*
      <section
        aria-label="Services Uptime Breakdown"
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs"
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">Services & Infrastructure</h3>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            90-Day History
          </span>
        </div>

        {summary.groups.length > 0 ? (
          summary.groups.map((group) => (
            <ServiceGroup key={group.id} group={group} />
          ))
        ) : (
          summary.ungrouped.map((service) => (
            <ServiceRow key={service.id} service={service} />
          ))
        )}

        {summary.groups.length > 0 && summary.ungrouped.length > 0 && (
          <div className="pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Other Services
            </h4>
            {summary.ungrouped.map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}
          </div>
        )}
      </section>

      <Legend />
      */}

      {/* Public Resolved Issues Section */}
      <section
        aria-labelledby="log-heading"
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <div>
          <h2 id="log-heading" className="text-lg font-bold text-slate-900">
            Incident Log & Resolved Issues
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {feedback.length === 0
              ? "No active or recent incidents reported."
              : `${feedback.length} ${
                  feedback.length === 1 ? "report" : "reports"
                } submitted and addressed by team.`}
          </p>
        </div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          View Full Public Log →
        </Link>
      </section>

      {/* Footer Timestamp */}
      <div className="pt-2 text-center text-xs font-medium text-slate-400">
        Last status update:{" "}
        <time dateTime={summary.updated_at}>
          {new Date(summary.updated_at).toUTCString()}
        </time>
      </div>
    </main>
  );
}
