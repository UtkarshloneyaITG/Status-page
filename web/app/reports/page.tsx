import Link from "next/link";

import FeedbackLog from "@/components/FeedbackLog";
import { getPublicFeedback } from "@/lib/feedback";

export const metadata = { title: "Incident & Resolution Log" };

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const items = await getPublicFeedback();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          ← Back to Status Overview
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Incident & Resolution Log
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Public log of user reports and engineering updates. {items.length}{" "}
          {items.length === 1 ? "report" : "reports"} published.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
        <FeedbackLog items={items} />
      </div>
    </main>
  );
}
