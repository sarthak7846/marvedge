"use client";

// Data + actions for the CRM connections tab.
//
// Split out of the component the way useSettings/useProfileForm are, so the tab
// is markup and this is the state machine.
//
// NOTHING HERE EVER HOLDS A STORED CREDENTIAL. A token typed into the add form
// lives in local state until it is POSTed and is then dropped; the list that
// comes back carries a masked `hint` and nothing more. There is no endpoint that
// would return a credential even if this asked for one.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { CrmProvider } from "@/app/lib/crm/types";

export interface CrmConnectionView {
  id: string;
  provider: CrmProvider;
  providerLabel: string;
  enabled: boolean;
  hint: string;
  lastOkAt: string | null;
  lastError: string | null;
  createdAt: string;
  fieldMap: Record<string, string>;
  failedDeliveries: number;
}

export interface NewConnectionDraft {
  provider: CrmProvider;
  hubspotToken: string;
  salesforceOid: string;
  salesforceReturnUrl: string;
  webhookUrl: string;
  webhookSecret: string;
  companySizeField: string;
}

export const EMPTY_DRAFT: NewConnectionDraft = {
  provider: "webhook",
  hubspotToken: "",
  salesforceOid: "",
  salesforceReturnUrl: "",
  webhookUrl: "",
  webhookSecret: "",
  companySizeField: "",
};

/** Build the provider-specific credential body the API expects. */
function credentialsFor(draft: NewConnectionDraft): unknown {
  switch (draft.provider) {
    case "hubspot":
      return { token: draft.hubspotToken.trim() };
    case "salesforce":
      return {
        oid: draft.salesforceOid.trim(),
        ...(draft.salesforceReturnUrl.trim()
          ? { returnUrl: draft.salesforceReturnUrl.trim() }
          : {}),
      };
    case "webhook":
      return { url: draft.webhookUrl.trim(), secret: draft.webhookSecret.trim() };
    default:
      return {};
  }
}

/** One fetch + JSON parse, throwing the server's own message on a non-2xx. */
async function request(path: string, init?: RequestInit, fallback = "Request failed") {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || fallback);
  }
  return data;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function useCrmConnections() {
  const [connections, setConnections] = useState<CrmConnectionView[]>([]);
  const [loading, setLoading] = useState(true);
  /** Null until the first load answers; false means the server flag is off. */
  const [crmEnabled, setCrmEnabled] = useState<boolean | null>(null);
  /** Set when the whole surface is unavailable (flag off, or plan too low). */
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<NewConnectionDraft>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/connections");
      if (res.status === 404) {
        setUnavailable("CRM delivery is not enabled on this deployment.");
        return;
      }
      if (res.status === 403) {
        setUnavailable("CRM delivery is available on the Pro and Enterprise plans.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load connections");
      }
      setUnavailable(null);
      setConnections(data.connections ?? []);
      setCrmEnabled(Boolean(data.crmEnabled));
    } catch (error) {
      console.error("Failed to load CRM connections:", error);
      toast.error("Failed to load CRM connections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Wraps a per-connection action in its busy flag, error toast and reload. */
  const act = useCallback(
    async (id: string, run: () => Promise<void>) => {
      setBusyId(id);
      try {
        await run();
        await load();
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const create = useCallback(async () => {
    setSaving(true);
    try {
      await request(
        "/api/crm/connections",
        jsonInit("POST", {
          provider: draft.provider,
          credentials: credentialsFor(draft),
          fieldMap: draft.companySizeField.trim()
            ? { companySize: draft.companySizeField.trim() }
            : undefined,
        }),
        "Failed to add the connection"
      );
      // The draft held a secret. Clearing it is the point, not tidiness.
      setDraft(EMPTY_DRAFT);
      toast.success("Connection added.");
      await load();
      return true;
    } catch (error) {
      toast.error((error as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, load]);

  const setEnabled = useCallback(
    (id: string, enabled: boolean) =>
      act(id, async () => {
        await request(
          `/api/crm/connections/${id}`,
          jsonInit("PATCH", { enabled }),
          "Failed to update the connection"
        );
      }),
    [act]
  );

  const remove = useCallback(
    (id: string) => {
      if (!confirm("Delete this CRM connection? Its delivery history goes with it.")) {
        return Promise.resolve();
      }
      return act(id, async () => {
        await request(
          `/api/crm/connections/${id}`,
          { method: "DELETE" },
          "Failed to delete the connection"
        );
        toast.success("Connection deleted.");
      });
    },
    [act]
  );

  /**
   * Sends a synthetic lead through the real delivery path. The message shown is
   * the provider's actual answer — a green tick here means a request really
   * succeeded, not that a form validated.
   */
  const test = useCallback(
    (id: string) =>
      act(id, async () => {
        const data = await request(
          `/api/crm/connections/${id}/test`,
          { method: "POST" },
          "The test could not be run"
        );
        if (data.success) {
          toast.success(data.detail || "Test lead accepted.");
        } else {
          toast.error(data.error || "The provider rejected the test lead.");
        }
      }),
    [act]
  );

  const resend = useCallback(
    (id: string) =>
      act(id, async () => {
        const data = await request(
          `/api/crm/connections/${id}/retry`,
          { method: "POST" },
          "The resend could not be run"
        );
        toast.success(
          `Resent ${data.attempted} delivery(s): ${data.delivered} succeeded, ${data.failed} still failing.`
        );
      }),
    [act]
  );

  return {
    connections,
    loading,
    crmEnabled,
    unavailable,
    busyId,
    saving,
    draft,
    setDraft,
    create,
    setEnabled,
    remove,
    test,
    resend,
    reload: load,
  };
}

export type UseCrmConnectionsReturn = ReturnType<typeof useCrmConnections>;
