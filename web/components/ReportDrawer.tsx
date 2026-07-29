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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => launch("issue")}
          className={`${trigger} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300`}
        >
          Report an issue
        </button>
        <button
          type="button"
          onClick={() => launch("suggestion")}
          className={`${trigger} border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800`}
        >
          Suggest an improvement
        </button>
      </div>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby="drawer-heading"
        className="my-0 ml-auto h-dvh max-h-dvh w-full max-w-none bg-white p-0 text-slate-900 backdrop:bg-slate-900/40 sm:w-1/2 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div>
              <h2 id="drawer-heading" className="text-lg font-semibold">
                Something not working? Tell us.
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                No account needed. You&apos;ll get a tracking ID to follow up
                with.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mt-1 shrink-0 rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Remount on type change so the form resets its own state. */}
            <ReportForm key={type} services={services} initialType={type} />
          </div>
        </div>
      </dialog>
    </>
  );
}
