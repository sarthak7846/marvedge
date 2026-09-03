"use client";

// The CRM connections tab.
//
// Four things an owner needs to do and this is all of them: add a connection,
// TEST it against the real provider, see whether it is working (lastOkAt /
// lastError), and resend what failed.
//
// TWO PIECES OF COPY IN HERE ARE LOAD-BEARING and must not be softened:
//
//  1. SALESFORCE DELIVERY IS UNCONFIRMED. Web-to-Lead returns no creation
//     receipt — a 2xx means "accepted", not "created" (see
//     app/lib/crm/salesforce.ts). The badge says "Accepted (unconfirmed)" for
//     that provider rather than "Delivered", because a customer who reads
//     "Delivered" and then cannot find the lead in Salesforce will reasonably
//     conclude the product lied to them.
//  2. A CREDENTIAL CANNOT BE READ BACK. The list shows a masked hint; there is
//     no reveal. Replacing a token means pasting a new one.
//
// Styling follows BrandingTab.tsx — the same card, the same #7C5CFC actions.
// This surface is signed-in Marvedge chrome, not a customer-hub page, so the
// Marvedge purple is correct here.

import { useState } from "react";

import { useCrmConnections } from "../hooks/useCrmConnections";
import type { CrmConnectionView } from "../hooks/useCrmConnections";
import type { CrmProvider } from "@/app/lib/crm/types";

const PROVIDER_OPTIONS: { value: CrmProvider; label: string; blurb: string }[] = [
  {
    value: "webhook",
    label: "Signed webhook",
    blurb:
      "POSTs each lead as JSON to a URL you control, signed with HMAC-SHA256 over `timestamp.body` in the X-Marvedge-Signature header.",
  },
  {
    value: "hubspot",
    label: "HubSpot",
    blurb:
      "Creates or updates a contact using a Private App token you mint in your own HubSpot portal (Settings → Integrations → Private Apps). It needs the crm.objects.contacts.write scope.",
  },
  {
    value: "salesforce",
    label: "Salesforce (Web-to-Lead)",
    blurb:
      "Posts to your org's Web-to-Lead endpoint using your org id. Salesforce returns no confirmation, so deliveries show as accepted rather than confirmed.",
  },
];

export default function CrmTab() {
  const crm = useCrmConnections();
  const [showForm, setShowForm] = useState(false);

  if (crm.unavailable) {
    return (
      <div className="px-2 sm:px-4 md:px-8 lg:px-16 xl:px-24 max-w-7xl mx-auto mt-8 mb-12">
        <div className="card bg-white rounded-xl border border-[#ede7fa] p-6 md:p-8">
          <h2 className="text-2xl font-bold mb-1 text-gray-800">CRM delivery</h2>
          <p className="text-gray-500">{crm.unavailable}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 md:px-8 lg:px-16 xl:px-24 max-w-7xl mx-auto mt-8 mb-12">
      <div className="w-full mb-6">
        <h2 className="text-2xl font-bold mb-1 text-gray-800">CRM delivery</h2>
        <p className="text-gray-500">
          Forward leads captured by your demo lead gate to HubSpot, Salesforce or your own endpoint.
        </p>
      </div>

      {crm.crmEnabled === false && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Outbound CRM delivery is switched off on this deployment (
          <code className="font-mono">OVERLAYS_CRM_ENABLED</code>). Leads are still captured and
          stored — nothing is sent to a CRM until it is turned on.
        </div>
      )}

      <div className="card bg-white rounded-xl border border-[#ede7fa] p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold text-gray-700">Connections</h3>
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="px-4 py-2 bg-[#7C5CFC] hover:bg-[#6c4be0] text-white text-xs font-semibold rounded-md transition-colors"
          >
            {showForm ? "Cancel" : "Add connection"}
          </button>
        </div>

        {showForm && (
          <AddConnectionForm
            crm={crm}
            onDone={() => {
              setShowForm(false);
            }}
          />
        )}

        {crm.loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : crm.connections.length === 0 ? (
          <p className="text-sm text-gray-400">
            No connections yet. Add one to start forwarding leads.
          </p>
        ) : (
          <ul className="space-y-4">
            {crm.connections.map((connection) => (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                busy={crm.busyId === connection.id}
                onTest={() => crm.test(connection.id)}
                onResend={() => crm.resend(connection.id)}
                onToggle={() => crm.setEnabled(connection.id, !connection.enabled)}
                onDelete={() => crm.remove(connection.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConnectionRow({
  connection,
  busy,
  onTest,
  onResend,
  onToggle,
  onDelete,
}: {
  connection: CrmConnectionView;
  busy: boolean;
  onTest: () => void;
  onResend: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-lg border border-[#ede7fa] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">{connection.providerLabel}</span>
            {!connection.enabled && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                Disabled
              </span>
            )}
          </div>
          <p className="mt-1 break-all font-mono text-xs text-gray-500">{connection.hint}</p>

          <p className="mt-2 text-xs text-gray-500">
            {connection.lastOkAt ? (
              <>
                {/* See the header comment: "delivered" would overstate what
                    Web-to-Lead actually tells us. */}
                {connection.provider === "salesforce" ? "Last accepted" : "Last delivered"}{" "}
                {new Date(connection.lastOkAt).toLocaleString()}
                {connection.provider === "salesforce" && (
                  <span className="text-gray-400">
                    {" "}
                    — unconfirmed; Web-to-Lead returns no creation receipt
                  </span>
                )}
              </>
            ) : (
              "Never delivered"
            )}
          </p>

          {connection.lastError && (
            <p className="mt-1 break-words text-xs text-red-600">{connection.lastError}</p>
          )}

          {connection.failedDeliveries > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {connection.failedDeliveries} failed delivery
              {connection.failedDeliveries === 1 ? "" : "s"} waiting to be resent.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onTest}
            disabled={busy}
            className="rounded-md bg-[#7C5CFC] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6c4be0] disabled:opacity-50"
          >
            {busy ? "Working…" : "Send test lead"}
          </button>
          {connection.failedDeliveries > 0 && (
            <button
              type="button"
              onClick={onResend}
              disabled={busy}
              className="rounded-md border border-[#ede7fa] bg-[#F6F3FF] px-3 py-1.5 text-xs font-semibold text-[#6E5AD8] transition-colors hover:bg-[#ece6ff] disabled:opacity-50"
            >
              Resend failed
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            {connection.enabled ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function AddConnectionForm({
  crm,
  onDone,
}: {
  crm: ReturnType<typeof useCrmConnections>;
  onDone: () => void;
}) {
  const { draft, setDraft, saving } = crm;
  const selected = PROVIDER_OPTIONS.find((option) => option.value === draft.provider);

  return (
    <form
      className="space-y-4 rounded-lg border border-dashed border-[#cfc4f7] bg-[#F6F3FF] p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const created = await crm.create();
        if (created) {
          onDone();
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Provider
        </label>
        <select
          value={draft.provider}
          onChange={(event) => setDraft({ ...draft, provider: event.target.value as CrmProvider })}
          className="rounded-md border border-[#ded5fb] bg-white px-3 py-2 text-sm text-gray-800"
        >
          {PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {selected && <p className="text-xs text-gray-500">{selected.blurb}</p>}
      </div>

      {draft.provider === "hubspot" && (
        <Field
          label="Private App token"
          value={draft.hubspotToken}
          onChange={(value) => setDraft({ ...draft, hubspotToken: value })}
          type="password"
          placeholder="pat-na1-…"
        />
      )}

      {draft.provider === "salesforce" && (
        <>
          <Field
            label="Organisation id (oid)"
            value={draft.salesforceOid}
            onChange={(value) => setDraft({ ...draft, salesforceOid: value })}
            placeholder="00D5f000000XXXX"
          />
          <Field
            label="Return URL (optional)"
            value={draft.salesforceReturnUrl}
            onChange={(value) => setDraft({ ...draft, salesforceReturnUrl: value })}
            placeholder="https://example.com/thanks"
          />
        </>
      )}

      {draft.provider === "webhook" && (
        <>
          <Field
            label="Endpoint URL"
            value={draft.webhookUrl}
            onChange={(value) => setDraft({ ...draft, webhookUrl: value })}
            placeholder="https://example.com/hooks/marvedge"
          />
          <Field
            label="Signing secret"
            value={draft.webhookSecret}
            onChange={(value) => setDraft({ ...draft, webhookSecret: value })}
            type="password"
            placeholder="At least 16 characters"
          />
        </>
      )}

      <Field
        label="Company-size field (optional)"
        value={draft.companySizeField}
        onChange={(value) => setDraft({ ...draft, companySizeField: value })}
        placeholder={
          draft.provider === "hubspot"
            ? "numemployees (default)"
            : draft.provider === "salesforce"
              ? "00N5f000000AAAA"
              : "Not used for webhooks"
        }
      />

      <p className="text-xs text-gray-500">
        Credentials are encrypted before they are stored and are never shown again — to change one,
        enter it afresh.
      </p>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-[#7C5CFC] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6c4be0] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save connection"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-[#ded5fb] bg-white px-3 py-2 text-sm text-gray-800"
        autoComplete="off"
      />
    </div>
  );
}
