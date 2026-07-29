export type FeedbackItem = {
  ref_code: string;
  type: "issue" | "suggestion";
  title: string;
  description: string;
  status: string;
  service: string | null;
  admin_reply: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AdminFeedbackItem = FeedbackItem & {
  id: string;
  reporter_email: string | null;
  internal_note: string | null;
  is_public: boolean;
  browser_meta: Record<string, string> | null;
};

export type FeedbackMeta = {
  label: string;
  dot: string;
  text: string;
  icon: string;
};

// The six triage states. Each pairs a colour with an icon and a word, so the
// badge never depends on colour alone.
export const FEEDBACK_META: Record<string, FeedbackMeta> = {
  new: {
    label: "New",
    dot: "bg-blue-500",
    text: "text-blue-700 font-semibold bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md",
    icon: "●",
  },
  under_review: {
    label: "Under Review",
    dot: "bg-amber-500",
    text: "text-amber-700 font-semibold bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md",
    icon: "◐",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-indigo-500",
    text: "text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md",
    icon: "▶",
  },
  fixed: {
    label: "Fixed",
    dot: "bg-emerald-500",
    text: "text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md",
    icon: "✓",
  },
  wont_fix: {
    label: "Won't Fix",
    dot: "bg-slate-400",
    text: "text-slate-600 font-semibold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md",
    icon: "—",
  },
  duplicate: {
    label: "Duplicate",
    dot: "bg-purple-500",
    text: "text-purple-700 font-semibold bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-md",
    icon: "⧉",
  },
};

export const FEEDBACK_STATUSES = Object.keys(FEEDBACK_META);

export function feedbackMeta(status: string): FeedbackMeta {
  return FEEDBACK_META[status] ?? FEEDBACK_META.new;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export function apiUrl(path: string): string {
  return `${API}${path}`;
}

/** The published log. Empty when the API is unreachable — never throws. */
export async function getPublicFeedback(): Promise<FeedbackItem[]> {
  try {
    const res = await fetch(apiUrl("/api/v1/feedback"), {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()).items;
  } catch {
    return [];
  }
}
