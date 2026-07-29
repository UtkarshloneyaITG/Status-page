"use client";

import { type AdminFeedbackItem } from "@/lib/feedback";

export default function ActivityTimeline({ item }: { item: AdminFeedbackItem }) {
  const events = [
    {
      id: "created",
      title: "Issue Reported",
      description: `Report submitted by ${item.reporter_email ?? "Anonymous User"}`,
      time: item.created_at,
      iconBg: "bg-blue-500",
    },
  ];

  if (item.admin_reply) {
    events.push({
      id: "reply",
      title: "Official Response Saved",
      description: "Admin logged an official team resolution update",
      time: item.resolved_at || item.created_at,
      iconBg: "bg-indigo-500",
    });
  }

  if (item.is_public) {
    events.push({
      id: "published",
      title: "Published on Status Page",
      description: "Report made visible on public status page",
      time: item.resolved_at || item.created_at,
      iconBg: "bg-emerald-500",
    });
  }

  if (item.status === "fixed" && item.resolved_at) {
    events.push({
      id: "resolved",
      title: "Marked Fixed & Closed",
      description: "Issue resolved and marked operational",
      time: item.resolved_at,
      iconBg: "bg-emerald-600",
    });
  }

  return (
    <div className="rounded-none border border-slate-200 bg-white p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
        Activity & Audit Log
      </h3>

      <ol className="relative border-l border-slate-200 ml-2 space-y-4 pt-1">
        {events.map((ev) => (
          <li key={ev.id} className="ml-4">
            <div className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-none ${ev.iconBg}`} />
            <div className="text-xs font-bold text-slate-900">{ev.title}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">{ev.description}</p>
            <time className="text-[10px] text-slate-400 font-semibold block mt-1">
              {new Date(ev.time).toUTCString()}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}
