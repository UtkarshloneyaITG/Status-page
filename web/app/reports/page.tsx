import Link from "next/link";

import FeedbackLog from "@/components/FeedbackLog";
import { getPublicFeedback } from "@/lib/feedback";

export const metadata = { title: "Reported and resolved" };

export default async function ReportsPage() {
  const items = await getPublicFeedback();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="text-sm text-slate-500 underline dark:text-slate-400"
      >
        ← Back to status
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        Reported and resolved
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        What people told us about, and what we did. {items.length}{" "}
        {items.length === 1 ? "report" : "reports"} published.
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        <FeedbackLog items={items} />
      </div>
    </main>
  );
}
