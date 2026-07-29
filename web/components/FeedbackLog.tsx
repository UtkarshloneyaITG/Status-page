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
      <div className="py-8 text-center text-sm text-slate-500">
        No incidents or resolutions logged yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.ref_code} className="py-5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
              {item.title}
            </h3>
            <Badge status={item.status} />
          </div>

          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {item.description}
          </p>

          {item.admin_reply && (
            <div className="mt-3 rounded-lg border-l-4 border-indigo-500 bg-slate-50 p-3 text-xs text-slate-700">
              <span className="font-bold text-slate-900 block mb-0.5">Team Update:</span>
              {item.admin_reply}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold text-[11px]">
              {item.ref_code}
            </span>
            <span className="capitalize">{item.type}</span>
            {item.service && <span>• {item.service}</span>}
            <time dateTime={item.resolved_at ?? item.created_at} className="ml-auto text-[11px]">
              {new Date(item.resolved_at ?? item.created_at).toUTCString()}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
