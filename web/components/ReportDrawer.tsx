"use client";

import { useEffect, useRef, useState } from "react";

import ReportForm from "./ReportForm";

type Option = { id: string; name: string };

/**
 * A right-hand slide-out panel built on native <dialog>, which gives the focus
 * trap, the backdrop, and Escape-to-close without a modal library.
 */
export default function ReportDrawer({ services }: { services: Option[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<"issue" | "suggestion">("issue");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function launch(next: "issue" | "suggestion") {
    setType(next);
    setOpen(true);
  }

  const trigger =
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => launch("issue")}
          className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 sm:text-sm"
        >
          Report an issue
        </button>
        <button
          type="button"
          onClick={() => launch("suggestion")}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900 sm:text-sm"
        >
          Suggest improvement
        </button>
      </div>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby="drawer-heading"
        className="my-0 ml-auto h-dvh max-h-dvh w-full max-w-lg bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/30 border-l border-slate-200"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/60 px-6 py-5">
            <div>
              <h2 id="drawer-heading" className="text-lg font-bold text-slate-900">
                Submit Feedback or Issue
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                No account needed. You will receive a tracking ID to follow up with our team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mt-1 shrink-0 rounded-lg p-1.5 text-lg leading-none text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <ReportForm key={type} services={services} initialType={type} />
          </div>
        </div>
      </dialog>
    </>
  );
}
