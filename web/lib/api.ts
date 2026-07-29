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

/**
 * Returns null when the API cannot be reached.
 *
 * A status page that fails to build or render because its backend is down is
 * the one thing this page must never do — that is exactly when people load it.
 * The caller renders a degraded view instead.
 */
export async function getSummary(): Promise<Summary | null> {
  try {
    const res = await fetch(`${API}/api/v1/status/summary`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Every service on the page, groups flattened, in display order. */
export function allServices(summary: Summary): Service[] {
  return [...summary.groups.flatMap((g) => g.services), ...summary.ungrouped];
}

// --- Admin Services & Infrastructure Interfaces ---

export type AdminService = {
  id: string;
  name: string;
  description: string | null;
  group_id: string | null;
  group_name: string | null;
  current_status: string;
  position: number;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminGroup = {
  id: string;
  name: string;
  position: number;
};

export type CreateServiceInput = {
  name: string;
  description?: string;
  group_id?: string;
  position?: number;
  initial_status?: string;
};

export type UpdateServiceInput = {
  name?: string;
  description?: string;
  group_id?: string;
  position?: number;
  current_status?: string;
};

// --- Admin Services API Calls ---

export async function fetchAdminServices(): Promise<AdminService[]> {
  const res = await fetch(`${API}/api/v1/admin/services`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load services");
  return res.json();
}

export async function fetchAdminGroups(): Promise<AdminGroup[]> {
  const res = await fetch(`${API}/api/v1/admin/groups`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load groups");
  return res.json();
}

export async function createAdminService(input: CreateServiceInput): Promise<{ id: string }> {
  const res = await fetch(`${API}/api/v1/admin/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create service");
  }
  return res.json();
}

export async function updateAdminService(serviceId: string, input: UpdateServiceInput): Promise<void> {
  const res = await fetch(`${API}/api/v1/admin/services/${serviceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update service");
  }
}

export async function deleteAdminService(serviceId: string): Promise<void> {
  const res = await fetch(`${API}/api/v1/admin/services/${serviceId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete service");
}

export async function updateServiceStatus(serviceId: string, status: string, note?: string): Promise<void> {
  const res = await fetch(`${API}/api/v1/admin/services/${serviceId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status, note }),
  });
  if (!res.ok) throw new Error("Failed to update status");
}

export async function bulkUpdateServiceStatus(serviceIds: string[], newStatus: string, note?: string): Promise<{ updated: number }> {
  const res = await fetch(`${API}/api/v1/admin/services/bulk-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ service_ids: serviceIds, new_status: newStatus, optional_note: note }),
  });
  if (!res.ok) throw new Error("Failed to perform bulk status update");
  return res.json();
}

export async function createAdminGroup(name: string): Promise<AdminGroup> {
  const res = await fetch(`${API}/api/v1/admin/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create service group");
  return res.json();
}

export async function deleteAdminGroup(groupId: string): Promise<void> {
  const res = await fetch(`${API}/api/v1/admin/groups/${groupId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete service group");
}
