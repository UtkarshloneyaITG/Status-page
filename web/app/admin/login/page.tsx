"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiUrl } from "@/lib/feedback";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch(apiUrl("/api/v1/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The session cookie is set by the API, so the request must carry
        // credentials and the API must allow this origin.
        credentials: "include",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError("Those credentials weren't accepted.");
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white text-xl shadow-md shadow-indigo-200">
            S
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Admin Portal
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Sign in to manage status reports and services
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-xs">
            <span className="mb-1.5 block font-bold text-slate-700">Email Address</span>
            <input
              name="email"
              type="email"
              required
              placeholder="admin@example.com"
              className={field}
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1.5 block font-bold text-slate-700">Password</span>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className={field}
            />
          </label>
          {error && (
            <p role="alert" className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in to Dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}
