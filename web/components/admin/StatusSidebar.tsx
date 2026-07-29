"use client";

import { feedbackMeta, FEEDBACK_STATUSES, type AdminFeedbackItem } from "@/lib/feedback";

export default function StatusSidebar({
  item,
  onPatch,
  onDelete,
}: {
  item: AdminFeedbackItem;
  onPatch: (body: Record<string, unknown>) => void;
  onDelete?: () => void;
}) {
  const m = feedbackMeta(item.status);

  return (
    <div className="space-y-5 rounded-none border border-slate-200 bg-white p-5  top-20 z-10">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2.5">
          Status & Triage Control
        </h3>

        {/* Current Status Pill Display */}
        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Current Status:</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${m.text}`}>
            <span aria-hidden="true">{m.icon}</span>
            {m.label}
          </span>
        </div>

        {/* Status Dropdown */}
        <label className="mt-3 block text-xs">
          <span className="mb-1 block font-semibold text-slate-700">Change Status</span>
          <select
            value={item.status}
            onChange={(e) => onPatch({ status: e.target.value })}
            className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
          >
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {feedbackMeta(s).label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Quick Action Buttons */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Actions
        </h4>

        {item.status !== "fixed" && (
          <button
            type="button"
            onClick={() => onPatch({ status: "fixed" })}
            className="w-full rounded-none bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            Mark Fixed ✓
          </button>
        )}

        <button
          type="button"
          onClick={() => onPatch({ is_public: !item.is_public })}
          className={`w-full rounded-none border px-3.5 py-2 text-xs font-semibold transition-colors ${
            item.is_public
              ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              : "border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
          }`}
        >
          {item.is_public ? "Hide from Status Page" : "Publish on Status Page"}
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="w-full rounded-none border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete Report
          </button>
        )}
      </div>

      {/* Metadata Overview */}
      <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Tracking Code:</span>
          <span className="font-mono font-bold text-slate-900">{item.ref_code}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Service:</span>
          <span className="font-bold text-slate-900">{item.service ?? "General"}</span>
        </div>
        {item.resolved_at && (
          <div className="flex justify-between">
            <span className="font-semibold text-slate-600">Resolved At:</span>
            <span className="font-semibold text-emerald-700">{new Date(item.resolved_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
