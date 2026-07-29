import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Status",
  description: "Service status and uptime",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
            <a href="/" className="flex items-center gap-2.5 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-sm shadow-indigo-200 transition-transform group-hover:scale-105">
                S
              </span>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  System Status
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Real-time Uptime Monitor
                </span>
              </div>
            </a>
            <nav className="flex items-center gap-1 sm:gap-2">
              <a
                href="/"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
              >
                Status
              </a>
              <a
                href="/reports"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
              >
                Incident Log
              </a>
              <a
                href="/admin"
                className="ml-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:text-sm"
              >
                Admin Portal
              </a>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="mt-auto border-t border-slate-200 bg-white py-6">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 px-4 text-center text-xs text-slate-500 sm:flex-row sm:px-6 sm:text-left">
            <p>© {new Date().getFullYear()} System Status Page. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="/" className="hover:text-slate-800">Status</a>
              <a href="/reports" className="hover:text-slate-800">Reports</a>
              <a href="/admin" className="hover:text-slate-800">Admin</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
