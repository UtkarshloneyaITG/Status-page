"use client";

import { useState } from "react";

import { apiUrl } from "@/lib/feedback";

type Option = { id: string; name: string };

export default function ReportForm({
  services,
  initialType = "issue",
}: {
  services: Option[];
  initialType?: "issue" | "suggestion";
}) {
  const [type, setType] = useState<"issue" | "suggestion">(initialType);
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const serviceId = String(form.get("service_id") ?? "");
    const email = String(form.get("reporter_email") ?? "").trim();

    try {
      const res = await fetch(apiUrl("/api/v1/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          service_id: serviceId || null,
          title: form.get("title"),
          description: form.get("description"),
          reporter_email: email || null,
          website: form.get("website") || null,
          // Captured silently so a report carries enough to reproduce it.
          browser_meta: {
            user_agent: navigator.userAgent,
            screen: `${window.screen.width}x${window.screen.height}`,
            page: window.location.href,
            language: navigator.language,
          },
        }),
      });

      if (res.status === 429) {
        setError("You've sent a few reports already. Please try again later.");
      } else if (!res.ok) {
        setError("That didn't send. Please check the fields and try again.");
      } else {
        setRef((await res.json()).ref_code);
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (ref) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-xs"
      >
        <p className="font-bold text-emerald-900 text-base">
          Report Logged Successfully!
        </p>
        <p className="mt-2 text-sm text-emerald-800">
          Your tracking reference code is{" "}
          <span className="rounded-md bg-emerald-100 border border-emerald-200 px-2 py-0.5 font-mono font-bold text-emerald-900">
            {ref}
          </span>
          . Use this ID to track updates. Once resolved, it will appear in the public log.
        </p>
        <button
          type="button"
          onClick={() => setRef(null)}
          className="mt-4 text-xs font-semibold text-emerald-900 underline hover:text-emerald-700"
        >
          Submit another report →
        </button>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Feedback Category
        </legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["issue", "Report an Issue"],
              ["suggestion", "Suggest Improvement"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold cursor-pointer transition-all ${
                type === value
                  ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-xs">
        <span className="mb-1.5 block font-bold text-slate-700">
          Affected Service <span className="font-normal text-slate-400">(Optional)</span>
        </span>
        <select name="service_id" className={field} defaultValue="">
          <option value="">General / Not Sure</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs">
        <span className="mb-1.5 block font-bold text-slate-700">Title / Summary</span>
        <input
          name="title"
          required
          maxLength={120}
          placeholder="e.g. Dashboard loading slowly"
          className={field}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1.5 block font-bold text-slate-700">Description</span>
        <textarea
          name="description"
          required
          maxLength={2000}
          rows={4}
          placeholder="Please describe what happened and how to reproduce it..."
          className={field}
        />
      </label>

      <label className="block text-xs">
        <span className="mb-1.5 block font-bold text-slate-700">
          Your Email <span className="font-normal text-slate-400">(Optional - for resolution updates)</span>
        </span>
        <input
          name="reporter_email"
          type="email"
          placeholder="you@example.com"
          className={field}
        />
      </label>

      {/* Honeypot */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {sending ? "Sending Report…" : "Submit Report"}
      </button>
    </form>
  );
}
