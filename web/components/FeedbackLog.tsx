"use client";

import { useMemo, useState } from "react";
import EmptyState from "./EmptyState";
import { feedbackMeta, type FeedbackItem } from "@/lib/feedback";

function Badge({ status }: { status: string }) {
  const m = feedbackMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${m.text}`}>
      <span aria-hidden="true">{m.icon}</span>
      {m.label}
    </span>
  );
}

export default function FeedbackLog({ items }: { items: FeedbackItem[] }) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        item.ref_code.toLowerCase().includes(search.toLowerCase());

      const matchesType = selectedType === "all" || item.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [items, search, selectedType]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="All Systems Operational"
        description="No incidents or issue reports have been logged recently. Check back anytime for live updates."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search by title, description, or tracking ID (RPT-####)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 shadow-2xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            ["all", "All Reports"],
            ["issue", "Issues"],
            ["suggestion", "Suggestions"],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSelectedType(val)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                selectedType === val
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Report List or Empty Filter Callout */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No matching reports found"
          description="We couldn't find any reports matching your search or filter parameters."
          resetLabel="Reset Search & Filters"
          onReset={() => {
            setSearch("");
            setSelectedType("all");
          }}
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          {filtered.map((item) => (
            <li key={item.ref_code} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {item.title}
                </h3>
                <Badge status={item.status} />
              </div>

              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                {item.description}
              </p>

              {item.admin_reply && (
                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-xs text-slate-700">
                  <span className="font-bold text-indigo-900 block mb-0.5">
                    Official Team Response:
                  </span>
                  {item.admin_reply}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="font-mono bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-bold text-[11px]">
                  {item.ref_code}
                </span>
                <span className="capitalize font-semibold text-slate-500">{item.type}</span>
                {item.service && <span>• {item.service}</span>}
                <time dateTime={item.resolved_at ?? item.created_at} className="ml-auto text-[11px] font-medium text-slate-400">
                  {new Date(item.resolved_at ?? item.created_at).toUTCString()}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
