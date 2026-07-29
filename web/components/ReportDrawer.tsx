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
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setClosing(false);
      dialog.showModal();
    }
  }, [open]);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      const dialog = ref.current;
      if (dialog && dialog.open) {
        dialog.close();
      }
      setOpen(false);
      setClosing(false);
    }, 320);
  }

  function launch(next: "issue" | "suggestion") {
    setType(next);
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => launch("issue")}
          className="rounded-none bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 sm:text-sm"
        >
          Report an issue
        </button>
        <button
          type="button"
          onClick={() => launch("suggestion")}
          className="rounded-none border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:text-sm"
        >
          Suggest improvement
        </button>
      </div>

      <dialog
        ref={ref}
        onCancel={(e) => {
          e.preventDefault();
          handleClose();
        }}
        onClick={(e) => {
          if (e.target === ref.current) handleClose();
        }}
        aria-labelledby="drawer-heading"
        className={`drawer-panel my-0 ml-auto h-dvh max-h-dvh w-full sm:w-1/2 md:w-1/2 max-w-none bg-white p-0 text-slate-900 border-l border-slate-200 outline-none ${
          closing ? "closing" : ""
        }`}
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
              onClick={handleClose}
              aria-label="Close"
              className="-mt-1 shrink-0 rounded-none p-1.5 text-lg leading-none text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
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
