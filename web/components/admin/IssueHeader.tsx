"use client";

import { feedbackMeta, type AdminFeedbackItem } from "@/lib/feedback";

export default function IssueHeader({ item }: { item: AdminFeedbackItem }) {
  const m = feedbackMeta(item.status);

  return (
    <div className="space-y-3 rounded-none border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-none">
            {item.ref_code}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-none">
            {item.type}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${m.text}`}>
            <span aria-hidden="true">{m.icon}</span>
            {m.label}
          </span>
          {item.is_public ? (
            <span className="rounded-none bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700">
              Published on Status Page
            </span>
          ) : (
            <span className="rounded-none bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
              Internal / Hidden
            </span>
          )}
        </div>

        <time dateTime={item.created_at} className="text-xs font-semibold text-slate-400">
          Created: {new Date(item.created_at).toUTCString()}
        </time>
      </div>

      <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        {item.title}
      </h2>

      {item.reporter_email && (
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Reporter:</span>
          <span className="font-semibold text-slate-700">{item.reporter_email}</span>
        </div>
      )}
    </div>
  );
}
