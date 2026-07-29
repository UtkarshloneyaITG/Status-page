"use client";

export default function DescriptionCard({ description }: { description: string }) {
  return (
    <div className="rounded-none border border-slate-200 bg-white p-5 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
        Report Description
      </h3>
      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
        {description}
      </p>
    </div>
  );
}
