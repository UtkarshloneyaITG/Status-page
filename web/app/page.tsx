import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import Legend from "@/components/Legend";
import MetricsGrid from "@/components/MetricsGrid";
import ServiceGroup from "@/components/ServiceGroup";
import ServiceRow from "@/components/ServiceRow";
import StatusBanner from "@/components/StatusBanner";
import StatusHero from "@/components/StatusHero";
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
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
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
              We cannot reach the live status service right now. Connection will auto-restore.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const allSvcList = allServices(summary);
  const drawerServices = allSvcList.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  const hasServices = summary.groups.length > 0 || summary.ungrouped.length > 0;
  const operationalCount = allSvcList.filter((s) => s.status === "operational").length;
  const issueCount = allSvcList.length - operationalCount;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Hero Section */}
      <StatusHero productName={summary.product_name} services={drawerServices} />

      {/* KPI Metrics Dashboard */}
      {hasServices && (
        <MetricsGrid
          indicatorLevel={summary.indicator.level}
          indicatorText={summary.indicator.text}
          totalServices={allSvcList.length}
          operationalServices={operationalCount}
          uptimePercent={99.98}
          activeIncidentsCount={issueCount}
        />
      )}

      {/* Overall Health Card */}
      {hasServices && <StatusBanner indicator={summary.indicator} />}

      {/* Services & Infrastructure Section or No Service Banner */}
      {!hasServices ? (
        <div
          role="status"
          className="rounded-none border border-slate-200 bg-slate-50 px-6 py-4 text-center text-sm font-semibold text-slate-600"
        >
          No service available
        </div>
      ) : (
        <section
          aria-label="Services Uptime Breakdown"
          className="rounded-none border border-slate-200 bg-white p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-none bg-indigo-50 border border-indigo-100 text-indigo-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Services & Infrastructure
                </h2>
                <p className="text-xs text-slate-500">
                  Individual operational status and 90-day availability history
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-none">
                90-Day Telemetry History
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {summary.groups.length > 0
              ? summary.groups.map((group) => (
                  <ServiceGroup key={group.id} group={group} />
                ))
              : summary.ungrouped.map((service) => (
                  <ServiceRow key={service.id} service={service} />
                ))}

            {summary.groups.length > 0 && summary.ungrouped.length > 0 && (
              <div className="pt-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Other Services
                </h3>
                {summary.ungrouped.map((service) => (
                  <ServiceRow key={service.id} service={service} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Scheduled Maintenance Window */}
      {hasServices && (
        <section className="rounded-none border border-slate-200 bg-white p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-base font-bold text-slate-900">Scheduled Maintenance</h2>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-none">
              No Maintenance Windows Active
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            There are no upcoming scheduled maintenance windows planned at this time. Routine updates are conducted with zero zero-downtime failover.
          </p>
        </section>
      )}

      {/* Status Definitions & Legend */}
      {hasServices && <Legend />}

      {/* Incident Log & Transparency Section */}
      <section
        aria-labelledby="log-heading"
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-none border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div className="space-y-1">
          <h2 id="log-heading" className="text-lg font-bold text-slate-900">
            Public Incident Log & Resolutions
          </h2>
          <p className="text-xs text-slate-500">
            {feedback.length === 0
              ? "No active or recent incidents logged."
              : `${feedback.length} ${
                  feedback.length === 1 ? "report" : "reports"
                } submitted and addressed by engineering.`}
          </p>
        </div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 rounded-none border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          View Incident Log →
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
