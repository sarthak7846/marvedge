"use client";

// The lead inbox: a paginated, demo-filterable table with a CSV export and a
// per-lead delete for subject-access requests.
//
// The delete is behind a confirm because it is irreversible and the row is
// someone else's personal data — the one place in this app where getting it
// wrong destroys something a customer cannot recover.

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Filter, Inbox, Trash2 } from "lucide-react";

import { useLeads, type LeadView } from "./useLeads";

/** Delivery status -> chip colours. Unknown statuses fall back to neutral. */
const STATUS_STYLES: Record<string, string> = {
  DELIVERED: "bg-[rgba(54,179,126,0.14)] text-[#2C8F66]",
  PENDING: "bg-[rgba(222,97,14,0.12)] text-[#C05A11]",
  FAILED: "bg-[rgba(227,54,41,0.12)] text-[#C02B20]",
};

function formatDate(iso: string): string {
  // UTC, matching the rollup's timezone rule and the CSV export, so the same
  // lead never appears to have arrived on two different days.
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function DeliveryChips({ lead }: { lead: LeadView }) {
  if (lead.deliveries.length === 0) {
    return <span className="text-xs text-[rgba(38,23,83,0.45)]">Not sent</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {lead.deliveries.map((delivery) => (
        <span
          key={delivery.id}
          title={delivery.lastError ?? undefined}
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            STATUS_STYLES[delivery.status] ?? "bg-[#F4F1FD] text-[#6356D7]"
          }`}
        >
          {delivery.provider}: {delivery.status.toLowerCase()}
          {delivery.attempts > 1 ? ` (${delivery.attempts})` : ""}
        </span>
      ))}
    </div>
  );
}

const LeadsClient = () => {
  const {
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
  } = useLeads();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <div className="relative flex h-full min-h-0 grow flex-col overflow-y-auto bg-[#F4F1FD] p-4 text-[#2D2154] md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-normal text-[rgba(0,0,0,0.43)] md:text-lg">
          {total === 0
            ? "Leads captured by your demos' lead gates."
            : `${total.toLocaleString()} lead${total === 1 ? "" : "s"} captured by your demos' lead gates.`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {demos.length > 0 ? (
            <label className="flex items-center gap-2 text-sm text-[#6356D7]">
              <Filter size={15} aria-hidden="true" />
              <span className="sr-only">Filter leads by demo</span>
              <select
                value={demoId}
                onChange={(event) => filterByDemo(event.target.value)}
                className="max-w-[220px] truncate rounded-lg border border-[#E5DCFF] bg-white px-2.5 py-1.5 text-sm font-medium text-[#2D1F61] outline-none focus:border-[#8A76FC]"
              >
                <option value="">All demos</option>
                {demos.map((demo) => (
                  <option key={demo.id} value={demo.id}>
                    {demo.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {/* A plain link, not a fetch-then-blob: the route streams, and letting
              the browser handle the download keeps the whole export out of this
              tab's memory. */}
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#8A76FC] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#6E5AD8]"
          >
            <Download size={15} aria-hidden="true" />
            Export CSV
          </a>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-[15px] bg-white p-4 shadow-sm md:p-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-[rgba(38,23,83,0.51)]">Loading leads…</p>
        ) : leads.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(138,118,252,0.25)]">
              <Inbox className="h-6 w-6 text-[#8A76FC]" />
            </div>
            <p className="text-lg font-semibold text-[rgba(38,23,83,0.66)]">No leads yet</p>
            <p className="max-w-md text-sm text-[rgba(38,23,83,0.51)] md:text-base">
              {demoId
                ? "This demo has not captured any leads yet."
                : "Add a lead gate to a demo in the editor sidebar, share it, and submissions appear here."}
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-xs uppercase tracking-wide text-[#8C82B4]">
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">Email</th>
                  <th className="py-2 pr-3 font-semibold">Company size</th>
                  <th className="py-2 pr-3 font-semibold">Demo</th>
                  <th className="py-2 pr-3 font-semibold">Submitted</th>
                  <th className="py-2 pr-3 font-semibold">Delivery</th>
                  <th className="py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-[#F0ECFF] align-top">
                    <td className="py-2.5 pr-3 font-medium text-[#2D1F61]">{lead.name}</td>
                    <td className="py-2.5 pr-3">
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-[#6356D7] underline-offset-2 hover:underline"
                      >
                        {lead.email}
                      </a>
                    </td>
                    <td className="py-2.5 pr-3 text-[rgba(38,23,83,0.72)]">
                      {lead.companySize ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-[rgba(38,23,83,0.72)]">
                      {lead.demoTitle ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-[rgba(38,23,83,0.72)]">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <DeliveryChips lead={lead} />
                    </td>
                    <td className="py-2.5 text-right">
                      {confirmingId === lead.id ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deletingId === lead.id}
                            onClick={async () => {
                              await remove(lead.id);
                              setConfirmingId(null);
                            }}
                            className="rounded-lg bg-[#C02B20] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {deletingId === lead.id ? "Deleting…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="rounded-lg border border-[#E5DCFF] px-2.5 py-1 text-xs font-semibold text-[#6356D7]"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(lead.id)}
                          aria-label={`Delete lead ${lead.name}`}
                          title="Delete this lead"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E5DCFF] px-2.5 py-1 text-xs font-semibold text-[#C02B20] transition-colors hover:bg-[rgba(227,54,41,0.06)]"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-3 flex shrink-0 items-center justify-between border-t border-[#F0ECFF] pt-3 text-sm">
            <span className="text-[rgba(38,23,83,0.51)]">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5DCFF] px-2.5 py-1 font-semibold text-[#6356D7] disabled:opacity-40"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5DCFF] px-2.5 py-1 font-semibold text-[#6356D7] disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Deleting here does not reach into a CRM the lead was already forwarded
          to. Saying so is more useful than implying a completeness we cannot
          deliver. */}
      <p className="mt-3 shrink-0 text-xs leading-relaxed text-[rgba(38,23,83,0.51)]">
        Deleting a lead removes it and its delivery records from Marvedge permanently. A lead
        already forwarded to a connected CRM must also be deleted there.
      </p>
    </div>
  );
};

export default LeadsClient;
