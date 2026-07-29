export type Day = {
  date: string;
  status: string | null;
  uptime: number | null;
  incident_id: string | null;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  uptime_percent: number | null;
  days: Day[];
};

export type Group = { id: string; name: string; services: Service[] };
export type Indicator = { level: string; text: string };

export type Summary = {
  product_name: string;
  updated_at: string;
  indicator: Indicator;
  groups: Group[];
  ungrouped: Service[];
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export async function getSummary(): Promise<Summary> {
  // The API already memoizes for 60s; matching that here keeps the page fresh
  // without hammering it.
  const res = await fetch(`${API}/api/v1/status/summary`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`status API returned ${res.status}`);
  return res.json();
}

/** Every service on the page, groups flattened, in display order. */
export function allServices(summary: Summary): Service[] {
  return [...summary.groups.flatMap((g) => g.services), ...summary.ungrouped];
}
