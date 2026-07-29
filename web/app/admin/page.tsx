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
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Reports</h1>
        <button
          onClick={signOut}
          className="text-sm text-slate-500 underline dark:text-slate-400"
        >
          Sign out
        </button>
      </div>

      {inbox && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["new", "in_progress", "fixed", "wont_fix"].map((s) => (
            <div
              key={s}
              className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800"
            >
              <div className="text-2xl font-semibold">
                {inbox.counts[s] ?? 0}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {feedbackMeta(s).label}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === value
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "border border-slate-300 dark:border-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-900">
          <span>{selected.size} selected</span>
          <button
            onClick={bulkFix}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
          >
            Mark fixed
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <ul className="mt-6 divide-y divide-slate-200 dark:divide-slate-800">
        {inbox?.items.length === 0 && (
          <li className="py-8 text-sm text-slate-500 dark:text-slate-400">
            Nothing here.
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
    <li className="py-5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleSelect}
          aria-label={`Select ${item.ref_code}`}
          className="mt-1.5 h-4 w-4"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-medium">{item.title}</span>
            <span className={`flex items-center gap-1.5 text-xs font-medium ${m.text}`}>
              <span aria-hidden="true">{m.icon}</span>
              {m.label}
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {item.description}
          </p>

          <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono">{item.ref_code}</span>
            <span>{item.type === "issue" ? "Issue" : "Suggestion"}</span>
            {item.service && <span>{item.service}</span>}
            {item.reporter_email && <span>{item.reporter_email}</span>}
            <time dateTime={item.created_at}>
              {new Date(item.created_at).toUTCString()}
            </time>
            {item.is_public && <span>Published</span>}
          </p>

          {item.browser_meta && (
            <details className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              <summary className="cursor-pointer">Environment</summary>
              <dl className="mt-1 space-y-0.5">
                {Object.entries(item.browser_meta).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="font-medium">{k}</dt>
                    <dd className="truncate">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Status
              <select
                value={item.status}
                onChange={(e) => onPatch({ status: e.target.value })}
                className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
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
              className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
            >
              {item.is_public ? "Hide from status page" : "Show on status page"}
            </button>

            {item.status !== "fixed" && (
              <button
                onClick={() => onPatch({ status: "fixed", admin_reply: reply || null })}
                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
              >
                Mark fixed
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Public reply, shown on the status page"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              onClick={() => onPatch({ admin_reply: reply || null })}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700"
            >
              Save reply
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
