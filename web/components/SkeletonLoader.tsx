"use client";

/**
 * Reusable animated shimmer skeleton loaders for loading states.
 */

export function StatusBannerSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-48 rounded-md bg-slate-200" />
          <div className="h-4 w-72 rounded-md bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export function ServiceGroupSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="h-5 w-44 rounded-md bg-slate-200" />
        <div className="h-5 w-24 rounded-full bg-slate-100" />
      </div>

      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 rounded-md bg-slate-200" />
            <div className="h-4 w-16 rounded-md bg-slate-100" />
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 45 }).map((_, idx) => (
              <div key={idx} className="h-7 flex-1 rounded-xs bg-slate-200/80" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportCardSkeleton() {
  return (
    <div className="w-full animate-pulse space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 rounded-md bg-slate-200" />
            <div className="h-4 w-20 rounded-full bg-slate-100" />
          </div>
          <div className="h-5 w-3/4 rounded-md bg-slate-200" />
          <div className="h-4 w-full rounded-md bg-slate-100" />
          <div className="h-4 w-2/3 rounded-md bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function AdminTableSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/60 p-4">
        <div className="h-4 w-40 rounded-md bg-slate-200" />
      </div>
      <div className="divide-y divide-slate-100 p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="pt-3 flex items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-48 rounded-md bg-slate-200" />
              <div className="h-3 w-72 rounded-md bg-slate-100" />
            </div>
            <div className="h-8 w-24 rounded-lg bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
