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
        className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950"
      >
        <p className="font-medium text-emerald-900 dark:text-emerald-100">
          Thanks — that&apos;s logged.
        </p>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
          Your tracking ID is{" "}
          <span className="font-mono font-semibold">{ref}</span>. Quote it if
          you follow up. Once we fix it, it appears in the log below.
        </p>
        <button
          type="button"
          onClick={() => setRef(null)}
          className="mt-4 text-sm font-medium text-emerald-900 underline dark:text-emerald-100"
        >
          Send another
        </button>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus-visible:ring-slate-100";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          What would you like to tell us?
        </legend>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["issue", "Report an issue"],
              ["suggestion", "Suggest an improvement"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="h-4 w-4"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Which service? <span className="font-normal text-slate-500">Optional</span>
        </span>
        <select name="service_id" className={field} defaultValue="">
          <option value="">Not sure</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Summary</span>
        <input
          name="title"
          required
          maxLength={120}
          placeholder="Checkout button does nothing"
          className={field}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">What happened?</span>
        <textarea
          name="description"
          required
          maxLength={2000}
          rows={4}
          placeholder="What you did, what you expected, what happened instead."
          className={field}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          Email <span className="font-normal text-slate-500">
            Optional — only used to tell you when it&apos;s fixed
          </span>
        </span>
        <input name="reporter_email" type="email" className={field} />
      </label>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {sending ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
