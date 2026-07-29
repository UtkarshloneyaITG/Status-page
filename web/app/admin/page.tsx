"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import EmptyState from "@/components/EmptyState";
import { AdminTableSkeleton } from "@/components/SkeletonLoader";
import {
  apiUrl,
  feedbackMeta,
  FEEDBACK_STATUSES,
  type AdminFeedbackItem,
} from "@/lib/feedback";

import ActivityTimeline from "@/components/admin/ActivityTimeline";
import DescriptionCard from "@/components/admin/DescriptionCard";
import EnvironmentCard from "@/components/admin/EnvironmentCard";
import IssueHeader from "@/components/admin/IssueHeader";
import PublicResponseCard from "@/components/admin/PublicResponseCard";
import StatusSidebar from "@/components/admin/StatusSidebar";

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
      setError(
        "Couldn't reach the API. Is it running on " + apiUrl("") + "?",
      );
    }
  }, [filter, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(ref: string, body: Record<string, unknown>) {
    setInbox((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => {
          if (item.ref_code === ref) {
            const nextStatus = (body.status as string) ?? item.status;
            const isFixed = nextStatus === "fixed";
            return {
              ...item,
              ...body,
              status: nextStatus,
              is_public: isFixed ? true : ((body.is_public as boolean) ?? item.is_public),
              admin_reply: body.admin_reply !== undefined ? (body.admin_reply as string | null) : item.admin_reply,
            };
          }
          return item;
        }),
      };
    });

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

  async function deleteReport(ref: string) {
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/feedback/${ref}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) setError("Couldn't delete report.");
    } catch {
      setError("Couldn't reach the API.");
    }
    await load();
  }

  async function bulkFix() {
    if (selected.size === 0) return;

    const refsToFix = Array.from(selected);

    setInbox((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          refsToFix.includes(item.ref_code)
            ? { ...item, status: "fixed", is_public: true }
            : item
        ),
      };
    });

    try {
      await fetch(apiUrl("/api/v1/admin/feedback/bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ref_codes: refsToFix, status: "fixed" }),
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
      // Ignore network failure on logout
    }
    router.push("/admin/login");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Feedback Management</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Triage, update status, and publish official responses to user reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/services"
            className="rounded-none bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Manage Services →
          </Link>
          <button
            onClick={signOut}
            className="rounded-none border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {inbox && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {["new", "in_progress", "fixed", "wont_fix"].map((s) => (
            <div
              key={s}
              className="rounded-none border border-slate-200 bg-white p-4"
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
            className={`rounded-none px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filter === value
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-none border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-xs font-semibold text-indigo-900">
          <span>{selected.size} reports selected</span>
          <button
            onClick={bulkFix}
            className="rounded-none bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            Mark selected fixed ✓
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="text-xs font-semibold text-red-600 bg-red-50 p-3.5 rounded-none border border-red-200">
          {error}
        </div>
      )}

      {!inbox && !error ? (
        <AdminTableSkeleton />
      ) : inbox?.items.length === 0 ? (
        <EmptyState
          title="All caught up"
          description="There are no reports in this view queue."
          resetLabel="View All Reports"
          onReset={() => setFilter("all")}
        />
      ) : (
        <div className="space-y-8">
          {inbox?.items.map((item) => (
            <ReportItem
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
              onDelete={() => deleteReport(item.ref_code)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ReportItem({
  item,
  checked,
  onToggleSelect,
  onPatch,
  onDelete,
}: {
  item: AdminFeedbackItem;
  checked: boolean;
  onToggleSelect: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const m = feedbackMeta(item.status);

  if (minimized) {
    return (
      <div className="rounded-none border border-slate-300 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded-none border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-none">
            {item.ref_code}
          </span>
          <h3 className="font-bold text-slate-900 text-sm truncate max-w-xs">{item.title}</h3>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${m.text}`}>
            <span aria-hidden="true">{m.icon}</span>
            {m.label}
          </span>
          {item.is_public && (
            <span className="rounded-none bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              Published
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="rounded-none border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Expand Panel ▼
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-none border border-slate-300 bg-slate-50/50 p-4 sm:p-6 space-y-4">
      {/* Top Selector Checkbox & Minimize Toggle */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded-none border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Select Report for Bulk Operations</span>
        </label>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold text-slate-500">{item.ref_code}</span>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="rounded-none border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Minimize Panel ▲
          </button>
        </div>
      </div>

      {/* 2-Column SaaS Enterprise Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (70% - 8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          <IssueHeader item={item} />
          <DescriptionCard description={item.description} />
          <PublicResponseCard
            initialReply={item.admin_reply}
            onSave={(reply) => onPatch({ admin_reply: reply })}
          />
          <EnvironmentCard meta={item.browser_meta} />
        </div>

        {/* Right Column / Sidebar (30% - 4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <StatusSidebar item={item} onPatch={onPatch} onDelete={onDelete} />
          <ActivityTimeline item={item} />
        </div>
      </div>
    </div>
  );
}
