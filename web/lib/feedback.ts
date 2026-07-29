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
    text: "text-blue-700 dark:text-blue-400",
    icon: "●",
  },
  under_review: {
    label: "Under Review",
    dot: "bg-amber-400",
    text: "text-amber-700 dark:text-amber-400",
    icon: "◐",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
    icon: "▶",
  },
  fixed: {
    label: "Fixed",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: "✓",
  },
  wont_fix: {
    label: "Won't Fix",
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-400",
    icon: "—",
  },
  duplicate: {
    label: "Duplicate",
    dot: "bg-purple-500",
    text: "text-purple-700 dark:text-purple-400",
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

/** The published log shown on the status page. */
export async function getPublicFeedback(): Promise<FeedbackItem[]> {
  const res = await fetch(apiUrl("/api/v1/feedback"), {
    next: { revalidate: 30 },
  });
  if (!res.ok) return [];
  return (await res.json()).items;
}
