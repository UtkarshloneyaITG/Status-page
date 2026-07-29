"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { AdminTableSkeleton } from "@/components/SkeletonLoader";

import {
  bulkUpdateServiceStatus,
  createAdminGroup,
  createAdminService,
  deleteAdminGroup,
  deleteAdminService,
  fetchAdminGroups,
  fetchAdminServices,
  updateAdminService,
  updateServiceStatus,
  type AdminGroup,
  type AdminService,
} from "@/lib/api";
import { meta, STATUS_META } from "@/lib/status";

export default function AdminServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<AdminService[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Selection
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Service Modals & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<AdminService | null>(null);
  const [deletingService, setDeletingService] = useState<AdminService | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Service Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groupFormError, setGroupFormError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<AdminGroup | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState("");
  const [status, setStatus] = useState("operational");
  const [position, setPosition] = useState(0);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [svcData, grpData] = await Promise.all([
        fetchAdminServices(),
        fetchAdminGroups(),
      ]);
      setServices(svcData);
      setGroups(grpData);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
        router.push("/admin/login");
        return;
      }
      setError("Failed to load services & groups. Please check your backend connection.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for Creation
  const openCreateModal = () => {
    setEditingService(null);
    setName("");
    setDescription("");
    setGroupId("");
    setStatus("operational");
    setPosition(services.length);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for Editing
  const openEditModal = (service: AdminService) => {
    setEditingService(service);
    setName(service.name);
    setDescription(service.description || "");
    setGroupId(service.group_id || "");
    setStatus(service.current_status);
    setPosition(service.position);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Service name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingService) {
        await updateAdminService(editingService.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          group_id: groupId || undefined,
          position: Number(position),
          current_status: status,
        });
        showToast(`Updated service "${name.trim()}" successfully.`);
      } else {
        await createAdminService({
          name: name.trim(),
          description: description.trim() || undefined,
          group_id: groupId || undefined,
          position: Number(position),
          initial_status: status,
        });
        showToast(`Created service "${name.trim()}" successfully.`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click Quick Status Toggle
  const handleQuickStatusUpdate = async (service: AdminService, newStatus: string) => {
    if (service.current_status === newStatus) return;

    // Optimistic UI Update
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, current_status: newStatus, updated_at: new Date().toISOString() } : s))
    );

    try {
      await updateServiceStatus(service.id, newStatus, "Quick status toggle");
      showToast(`${service.name} set to ${meta(newStatus).label}`);
    } catch {
      showToast(`Failed to update status for ${service.name}`, "error");
      await loadData();
    }
  };

  // Bulk Status Update
  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    try {
      const res = await bulkUpdateServiceStatus(ids, newStatus, "Bulk status update from dashboard");
      showToast(`Updated ${res.updated} services to ${meta(newStatus).label}`);
      setSelectedIds(new Set());
      await loadData();
    } catch {
      showToast("Bulk status update failed", "error");
    }
  };

  // Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingService) return;
    try {
      await deleteAdminService(deletingService.id);
      showToast(`Deleted service "${deletingService.name}"`);
      setDeletingService(null);
      await loadData();
    } catch {
      showToast("Failed to delete service", "error");
    }
  };

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredServices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredServices.map((s) => s.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered Services List
  const handleGroupFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setGroupFormError("Group name is required");
      return;
    }
    setIsSubmittingGroup(true);
    setGroupFormError(null);
    try {
      await createAdminGroup(groupName.trim());
      showToast("Service group created successfully");
      setIsGroupModalOpen(false);
      setGroupName("");
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create group";
      setGroupFormError(msg);
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleGroupDeleteConfirm = async () => {
    if (!deletingGroup) return;
    try {
      await deleteAdminGroup(deletingGroup.id);
      showToast(`Group "${deletingGroup.name}" deleted successfully`);
      setDeletingGroup(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete group";
      showToast(msg, "error");
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        service.name.toLowerCase().includes(search.toLowerCase()) ||
        (service.description && service.description.toLowerCase().includes(search.toLowerCase()));

      const matchesGroup =
        filterGroup === "all" ||
        (filterGroup === "ungrouped" ? !service.group_id : service.group_id === filterGroup);

      const matchesStatus =
        filterStatus === "all" || service.current_status === filterStatus;

      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [services, search, filterGroup, filterStatus]);

  const operationalCount = services.filter((s) => s.current_status === "operational").length;
  const issueCount = services.length - operationalCount;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-none border px-4 py-3 text-xs font-semibold ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>{toast.type === "error" ? "Notice:" : "Success:"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            ← Back to Admin Inbox
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Services & Infrastructure
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Create, manage, and toggle real-time health across all system services
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setGroupName("");
              setGroupFormError(null);
              setIsGroupModalOpen(true);
            }}
            className="rounded-none border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Create Service Group
          </button>
          <button
            onClick={openCreateModal}
            className="rounded-none bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            + Add New Service
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-none border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-slate-900">{services.length}</div>
          <div className="mt-0.5 text-xs font-semibold text-slate-500">Total Services</div>
        </div>
        <div className="rounded-none border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="text-2xl font-bold text-emerald-900">{operationalCount}</div>
          <div className="mt-0.5 text-xs font-semibold text-emerald-700">Operational</div>
        </div>
        <div className="rounded-none border border-amber-200 bg-amber-50/60 p-4">
          <div className="text-2xl font-bold text-amber-900">{issueCount}</div>
          <div className="mt-0.5 text-xs font-semibold text-amber-700">Active Incidents / Outages</div>
        </div>
      </div>

      {/* Service Groups Management Panel */}
      <section className="rounded-none border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Service Groups ({groups.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Configured categories for grouping infrastructure services
            </p>
          </div>
          <button
            onClick={() => {
              setGroupName("");
              setGroupFormError(null);
              setIsGroupModalOpen(true);
            }}
            className="rounded-none border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            + Create Group
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No service groups created yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {groups.map((g) => {
              const count = services.filter((s) => s.group_id === g.id).length;
              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-none border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="min-w-0 pr-2">
                    <h3 className="text-xs font-bold text-slate-900 truncate">{g.name}</h3>
                    <span className="text-[11px] font-medium text-slate-500">
                      {count} {count === 1 ? "service" : "services"}
                    </span>
                  </div>
                  <button
                    onClick={() => setDeletingGroup(g)}
                    className="shrink-0 rounded-none border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete Group
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Search & Filter Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by service name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-none border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="rounded-none border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
        >
          <option value="all">All Groups ({services.length})</option>
          <option value="ungrouped">Ungrouped</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-none border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_META).map(([key, m]) => (
            <option key={key} value={key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-indigo-200 bg-indigo-50/90 px-4 py-3 text-xs font-semibold text-indigo-900">
          <span>{selectedIds.size} service(s) selected</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-slate-500 font-normal">Bulk set:</span>
            {Object.entries(STATUS_META).map(([key, m]) => (
              <button
                key={key}
                onClick={() => handleBulkStatusUpdate(key)}
                className="rounded-none bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Service List */}
      {error && (
        <div role="alert" className="text-xs font-semibold text-red-600 bg-red-50 p-4 rounded-none border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <AdminTableSkeleton />
      ) : filteredServices.length === 0 ? (
        <EmptyState
          title="No services found"
          description={
            search || filterGroup !== "all" || filterStatus !== "all"
              ? "No services matched your active search or filter rules."
              : "No infrastructure services exist in your database yet."
          }
          actionLabel={search || filterGroup !== "all" || filterStatus !== "all" ? undefined : "+ Add First Service"}
          onAction={openCreateModal}
          resetLabel={search || filterGroup !== "all" || filterStatus !== "all" ? "Reset Filters" : undefined}
          onReset={() => {
            setSearch("");
            setFilterGroup("all");
            setFilterStatus("all");
          }}
        />
      ) : (
        <div className="rounded-none border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-xs font-bold text-slate-500">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredServices.length && filteredServices.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded-none border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Service Details</span>
            </div>
            <span className="hidden sm:inline">Quick Status Controls</span>
          </div>

          <ul className="divide-y divide-slate-100">
            {filteredServices.map((svc) => {
              const m = meta(svc.current_status);
              const isSelected = selectedIds.has(svc.id);

              return (
                <li
                  key={svc.id}
                  className={`p-5 transition-colors ${
                    isSelected ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: Info & Badges */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(svc.id)}
                        className="mt-1 h-4 w-4 rounded-none border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm sm:text-base">
                            {svc.name}
                          </span>
                          {svc.group_name && (
                            <span className="rounded-none bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                              {svc.group_name}
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1.5 text-xs ${m.text}`}>
                            <span aria-hidden="true">{m.icon}</span>
                            {m.label}
                          </span>
                        </div>

                        {svc.description && (
                          <p className="text-xs text-slate-500 leading-relaxed truncate">
                            {svc.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span>Pos: #{svc.position}</span>
                          {svc.updated_at && (
                            <span>
                              Updated: {new Date(svc.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Status Buttons & Actions */}
                    <div className="flex flex-col gap-2.5 sm:items-end">
                      {/* 1-Click Status Controls */}
                      <div className="flex flex-wrap items-center gap-1">
                        {Object.entries(STATUS_META).map(([stKey, stMeta]) => {
                          const isActive = svc.current_status === stKey;
                          return (
                            <button
                              key={stKey}
                              onClick={() => handleQuickStatusUpdate(svc, stKey)}
                              title={`Set status to ${stMeta.label}`}
                              className={`rounded-none px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                isActive
                                  ? `${stMeta.dot} text-white ring-2 ring-offset-1 ring-slate-400`
                                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 opacity-80 hover:opacity-100"
                              }`}
                            >
                              {stMeta.icon} <span className="hidden lg:inline">{stMeta.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Edit & Delete Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(svc)}
                          className="rounded-none border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingService(svc)}
                          className="rounded-none border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Create / Edit Service Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-none border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingService ? "Edit Service" : "Add New Infrastructure Service"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <label className="block">
                <span className="mb-1 block font-bold text-slate-700">Service Name *</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Authentication API"
                  className="w-full rounded-none border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-bold text-slate-700">Description (Optional)</span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what this service does..."
                  className="w-full rounded-none border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block font-bold text-slate-700">Service Group</span>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                  >
                    <option value="">None (Ungrouped)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block font-bold text-slate-700">Display Order / Position</span>
                  <input
                    type="number"
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block font-bold text-slate-700">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                >
                  {Object.entries(STATUS_META).map(([key, m]) => (
                    <option key={key} value={key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>

              {formError && (
                <div role="alert" className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-none border border-red-200">
                  {formError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-none border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-none bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Saving..." : editingService ? "Save Changes" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-none border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Delete Service</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{deletingService.name}</strong>? This action will remove the service and its associated status history records.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingService(null)}
                className="rounded-none border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-none bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Delete Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-none border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Delete Service Group</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900">{deletingGroup.name}</strong>? Any services currently in this group will become ungrouped (no services will be deleted).
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingGroup(null)}
                className="rounded-none border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGroupDeleteConfirm}
                className="rounded-none bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Service Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-none border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Create New Service Group</h2>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGroupFormSubmit} className="space-y-4 text-xs">
              <label className="block">
                <span className="mb-1 block font-bold text-slate-700">Group Name *</span>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Core APIs, Databases, Edge Services"
                  className="w-full rounded-none border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
                />
              </label>

              {groupFormError && (
                <div role="alert" className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-none border border-red-200">
                  {groupFormError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="rounded-none border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGroup}
                  className="rounded-none bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmittingGroup ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
