"use client";

import { useState } from "react";

export default function EnvironmentCard({
  meta,
}: {
  meta: Record<string, string> | null;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!meta) return null;

  function copyValue(key: string, val: string) {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  return (
    <details className="group rounded-none border border-slate-200 bg-white p-5">
      <summary className="flex cursor-pointer items-center justify-between font-bold text-xs text-slate-700 uppercase tracking-wider select-none">
        <span>Environment & Telemetry Details</span>
        <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
      </summary>

      <div className="mt-4 space-y-2 pt-3 border-t border-slate-100">
        <dl className="grid grid-cols-1 gap-2 text-xs">
          {Object.entries(meta).map(([key, val]) => (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-none border border-slate-100 bg-slate-50/70 p-2.5"
            >
              <div className="min-w-0 flex-1">
                <dt className="font-bold text-slate-700 capitalize text-[11px]">
                  {key.replace("_", " ")}
                </dt>
                <dd className="font-mono text-slate-600 truncate text-[11px] mt-0.5">
                  {val}
                </dd>
              </div>

              <button
                type="button"
                onClick={() => copyValue(key, val)}
                className="shrink-0 self-start sm:self-center rounded-none border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {copiedKey === key ? "Copied ✓" : "Copy"}
              </button>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
