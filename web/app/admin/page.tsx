"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  apiUrl,
  feedbackMeta,
  FEEDBACK_STATUSES,
  type AdminFeedbackItem,
} from "@/lib/feedback";

type Inbox = { counts: Record<string, number>; items: AdminFeedbackItem[] };

const FILTERS = [["new", "New"], ["all", "Everything"], ...FEEDBACK_STATUSES.filter((s) => s !== "new").map((s) => [s, feedbackMeta(s).label])] as [string, string][];

export default function AdminPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("new");
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        apiUrl(`/api/v1/admin/feedback?status=${filter}`),
        { credentials: "include", cache: "no-store" },
      );
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        setError("Couldn't load the inbox.");
        return;
      }
      setError(null);
      setInbox(await res.json());
      setSelected(new Set());
    } catch {
      // A down API must show a message, not crash the page.
      setError(
        "Couldn't reach the API. Is it running on " + apiUrl("") + "?",
      );
    }
  }, [filter, router]);

  useEffect(() => {
    // Fetching the inbox from the API is exactly the external-system sync an
    // effect is for; the setState happens after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function patch(ref: string, body: Record<string, unknown>) {
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/feedback/${ref}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) setError("That change didn't save.");
    } catch {
      setError("Couldn't reach the API.");
    }
    await load();
  }

  async function bulkFix() {
    if (selected.size === 0) return;
    try {
      await fetch(apiUrl("/api/v1/admin/feedback/bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ref_codes: [...selected], status: "fixed" }),
      });
    } catch {
      setError("Couldn't reach the API.");
    }
    await load();
  }

  async function signOut() {
    try {
      await fetch(apiUrl("/api/v1/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Signing out locally still matters when the API is unreachable.
    }
    router.push("/admin/login");
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Inbox</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Triage, update status, and respond to incoming user reports
          </p>
        </div>
        <button
          onClick={signOut}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          Sign out
        </button>
      </div>

      {inbox && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {["new", "in_progress", "fixed", "wont_fix"].map((s) => (
            <div
              key={s}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
            >
              <div className="text-3xl font-bold text-slate-900">
                {inbox.counts[s] ?? 0}
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                {feedbackMeta(s).label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filter === value
                ? "bg-indigo-600 text-white shadow-2xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-xs font-semibold text-indigo-900 shadow-2xs">
          <span>{selected.size} reports selected</span>
          <button
            onClick={bulkFix}
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            Mark selected fixed ✓
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="text-xs font-semibold text-red-600 bg-red-50 p-3.5 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <ul className="divide-y divide-slate-100">
          {inbox?.items.length === 0 && (
            <li className="py-12 text-center text-sm font-medium text-slate-400">
              No reports found in this view.
            </li>
          )}
          {inbox?.items.map((item) => (
            <Report
              key={item.ref_code}
              item={item}
              checked={selected.has(item.ref_code)}
              onToggleSelect={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(item.ref_code)) {
                    next.delete(item.ref_code);
                  } else {
                    next.add(item.ref_code);
                  }
                  return next;
                })
              }
              onPatch={(body) => patch(item.ref_code, body)}
            />
          ))}
        </ul>
      </div>
    </main>
  );
}

function Report({
  item,
  checked,
  onToggleSelect,
  onPatch,
}: {
  item: AdminFeedbackItem;
  checked: boolean;
  onToggleSelect: () => void;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [reply, setReply] = useState(item.admin_reply ?? "");
  const m = feedbackMeta(item.status);

  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleSelect}
          aria-label={`Select ${item.ref_code}`}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">{item.title}</h3>
            <span className={`inline-flex items-center gap-1.5 text-xs ${m.text}`}>
              <span aria-hidden="true">{m.icon}</span>
              {m.label}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {item.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold text-[11px]">
              {item.ref_code}
            </span>
            <span className="capitalize">{item.type}</span>
            {item.service && <span>• {item.service}</span>}
            {item.reporter_email && <span>• {item.reporter_email}</span>}
            <time dateTime={item.created_at} className="text-[11px]">
              {new Date(item.created_at).toUTCString()}
            </time>
            {item.is_public && (
              <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                Published
              </span>
            )}
          </div>

          {item.browser_meta && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-800">
                Environment Details
              </summary>
              <dl className="mt-1.5 space-y-1 rounded-lg bg-slate-50 p-2.5 text-[11px]">
                {Object.entries(item.browser_meta).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="font-bold text-slate-700 capitalize">{k.replace("_", " ")}:</dt>
                    <dd className="truncate text-slate-600">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              Status:
              <select
                value={item.status}
                onChange={(e) => onPatch({ status: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-2xs outline-none focus:border-indigo-500"
              >
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {feedbackMeta(s).label}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => onPatch({ is_public: !item.is_public })}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              {item.is_public ? "Hide from Status Page" : "Publish on Status Page"}
            </button>

            {item.status !== "fixed" && (
              <button
                onClick={() => onPatch({ status: "fixed", admin_reply: reply || null })}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
              >
                Mark Fixed ✓
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a public response for the status page..."
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-2xs outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => onPatch({ admin_reply: reply || null })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              Save Response
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
