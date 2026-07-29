"use client";

import { useState } from "react";

export default function PublicResponseCard({
  initialReply,
  onSave,
}: {
  initialReply: string | null;
  onSave: (reply: string | null) => void;
}) {
  const [reply, setReply] = useState(initialReply ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [savedSuccess, setSavedSuccess] = useState(false);

  function handleSave() {
    onSave(reply.trim() || null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  }

  return (
    <div className="rounded-none border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Public Official Response
          </h3>
          <p className="text-[11px] text-slate-400">
            This response will be published on the public status page alongside the report.
          </p>
        </div>

        {/* Write / Preview Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={`px-3 py-1 text-xs font-semibold ${
              tab === "write" ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`px-3 py-1 text-xs font-semibold ${
              tab === "preview" ? "bg-white text-slate-900" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {tab === "write" ? (
        <div className="space-y-2">
          <textarea
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write an official update or resolution notes for users..."
            className="w-full rounded-none border border-slate-300 bg-white p-3 text-xs text-slate-900 outline-none focus:border-indigo-500"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{reply.length} / 1000 characters</span>
            {savedSuccess && (
              <span className="font-semibold text-emerald-700">Response saved successfully ✓</span>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-[100px] rounded-none border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-800 leading-relaxed">
          {reply.trim() ? (
            <p className="whitespace-pre-wrap">{reply}</p>
          ) : (
            <p className="text-slate-400 italic">No response text written yet.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-none border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Save Response
        </button>
      </div>
    </div>
  );
}
