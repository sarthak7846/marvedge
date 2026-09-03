"use client";

// Data + actions for the lead inbox.
//
// Split out of the component the way useCrmConnections is, so LeadsClient is
// markup and this is the state machine.
//
// Every request here is owner-scoped SERVER-SIDE, in app/api/leads/*. Nothing in
// this file is a permission check — the demo filter is a convenience, and asking
// for a demo the signed-in user does not own returns an empty page rather than
// somebody else's leads.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface LeadDeliveryView {
  id: string;
  provider: string;
  status: string;
  attempts: number;
  lastError: string | null;
  deliveredAt: string | null;
}

export interface LeadView {
  id: string;
  name: string;
  email: string;
  companySize: string | null;
  createdAt: string;
  consentAt: string | null;
  consentText: string | null;
  referrer: string | null;
  demoId: string;
  demoTitle: string | null;
  deliveries: LeadDeliveryView[];
  deliverySummary: string;
}

export interface LeadDemoOption {
  id: string;
  title: string;
}

export function useLeads() {
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [demos, setDemos] = useState<LeadDemoOption[]>([]);
  const [demoId, setDemoId] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (demoId) {
        params.set("demoId", demoId);
      }
      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load leads");
      }
      setLeads(data.leads ?? []);
      setDemos(data.demos ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (error) {
      // The message is the route's own literal; it never contains a lead field.
      console.error("Failed to load leads:", (error as Error).message);
      toast.error("Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [demoId, page]);

  useEffect(() => {
    load();
  }, [load]);

  /** Changing the filter resets to page 1 — page 4 of a narrower list is empty. */
  const filterByDemo = useCallback((nextDemoId: string) => {
    setDemoId(nextDemoId);
    setPage(1);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Failed to delete the lead");
        }
        toast.success("Lead deleted.");
        // Deleting the last row of the last page would otherwise leave the user
        // staring at an empty page with no way back.
        if (leads.length === 1 && page > 1) {
          setPage((current) => current - 1);
        } else {
          await load();
        }
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setDeletingId(null);
      }
    },
    [leads.length, load, page]
  );

  const exportHref = demoId
    ? `/api/leads/export?demoId=${encodeURIComponent(demoId)}`
    : "/api/leads/export";

  return {
    leads,
    demos,
    demoId,
    page,
    totalPages,
    total,
    loading,
    deletingId,
    exportHref,
    filterByDemo,
    setPage,
    remove,
    reload: load,
  };
}
