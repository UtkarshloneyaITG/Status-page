import Link from "next/link";

import FeedbackLog from "@/components/FeedbackLog";
import { getPublicFeedback } from "@/lib/feedback";

export const metadata = { title: "Incident & Resolution Log" };

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const items = await getPublicFeedback();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          ← Back to Status Overview
        </Link>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Incident & Resolution Log
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Public transparency record of reports and official engineering team resolutions ({items.length} total).
        </p>
      </div>

      <FeedbackLog items={items} />
    </main>
  );
}
