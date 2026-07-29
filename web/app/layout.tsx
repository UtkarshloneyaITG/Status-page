import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "System Status & Performance Dashboard",
  description: "Enterprise real-time status monitor across core infrastructure, APIs, and services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50/70 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        {/* Sticky Glassmorphism Header */}
        <header className="sticky top-0 z-40 border-b border-slate-200/80 glass-header">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
            {/* Logo Mark */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-none bg-indigo-600 font-bold text-white transition-transform group-hover:scale-105">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-slate-900">
                  Status Platform
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Enterprise Infrastructure Uptime
                </span>
              </div>
            </Link>

            {/* Navigation Menu */}
            <nav className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/"
                className="rounded-none px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100/80 hover:text-slate-900 sm:text-sm"
              >
                Status
              </Link>
              <Link
                href="/reports"
                className="rounded-none px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100/80 hover:text-slate-900 sm:text-sm"
              >
                Incident Log
              </Link>
              <Link
                href="/admin"
                className="ml-2 rounded-none border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 transition-all hover:border-indigo-300 hover:bg-slate-50 hover:text-indigo-600 sm:text-sm"
              >
                Admin Portal →
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Body */}
        <div className="flex-1">{children}</div>

        {/* Enterprise SaaS Footer */}
        <footer className="mt-auto border-t border-slate-200/80 bg-white py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs font-medium text-slate-500 sm:flex-row sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live 30s Auto-Polling
              </span>
              <span>•</span>
              <p>© {new Date().getFullYear()} Status Platform Inc. All rights reserved.</p>
            </div>

            <div className="flex items-center gap-5 text-slate-600 font-semibold">
              <Link href="/" className="hover:text-indigo-600 transition-colors">System Overview</Link>
              <Link href="/reports" className="hover:text-indigo-600 transition-colors">Incident Log</Link>
              <Link href="/admin" className="hover:text-indigo-600 transition-colors">Admin Dashboard</Link>
              <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-600">v1.2.0</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
