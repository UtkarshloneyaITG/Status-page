import { feedbackMeta, type FeedbackItem } from "@/lib/feedback";

function Badge({ status }: { status: string }) {
  const m = feedbackMeta(status);
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${m.text}`}>
      <span aria-hidden="true">{m.icon}</span>
      {m.label}
    </span>
  );
}

export default function FeedbackLog({ items }: { items: FeedbackItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Nothing reported and resolved yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {items.map((item) => (
        <li key={item.ref_code} className="py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-medium">{item.title}</span>
            <Badge status={item.status} />
          </div>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {item.description}
          </p>

          {item.admin_reply && (
            <p className="mt-2 border-l-2 border-slate-300 pl-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
              {item.admin_reply}
            </p>
          )}

          <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono">{item.ref_code}</span>
            <span>{item.type === "issue" ? "Issue" : "Suggestion"}</span>
            {item.service && <span>{item.service}</span>}
            <time dateTime={item.resolved_at ?? item.created_at}>
              {new Date(item.resolved_at ?? item.created_at).toUTCString()}
            </time>
          </p>
        </li>
      ))}
    </ul>
  );
}
