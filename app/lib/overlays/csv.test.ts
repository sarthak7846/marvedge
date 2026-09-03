import { describe, expect, it } from "vitest";

import {
  LEAD_CSV_COLUMNS,
  csvCell,
  csvRow,
  leadCsvHeader,
  leadCsvRow,
  summarizeDeliveries,
} from "./csv";

describe("csvCell — RFC 4180 quoting", () => {
  it("leaves an ordinary value alone", () => {
    expect(csvCell("Ada Lovelace")).toBe("Ada Lovelace");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
  });

  it("quotes a value containing a comma", () => {
    // Unquoted, this shifts every later column by one — silently.
    expect(csvCell("Acme, Inc.")).toBe('"Acme, Inc."');
  });

  it("quotes and doubles an embedded double quote", () => {
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("renders null and undefined as an empty cell", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("renders a Date as ISO-8601 UTC", () => {
    expect(csvCell(new Date("2026-09-01T12:34:56.000Z"))).toBe("2026-09-01T12:34:56.000Z");
  });

  it("renders an invalid Date as empty rather than 'Invalid Date'", () => {
    expect(csvCell(new Date("nonsense"))).toBe("");
  });
});

describe("csvCell — formula neutralisation (CSV injection)", () => {
  // The attack: a viewer types this into the name field of a lead gate, the
  // owner exports and opens the CSV, and their spreadsheet executes it.
  it("neutralises a leading = with an apostrophe", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell('=HYPERLINK("https://evil.example/x","Click")')).toBe(
      '"\'=HYPERLINK(""https://evil.example/x"",""Click"")"'
    );
  });

  it("neutralises every formula-triggering prefix", () => {
    expect(csvCell("+1234")).toBe("'+1234");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    // A tab needs neutralising but not quoting — it is not a delimiter here.
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    // A carriage return needs both.
    expect(csvCell("\rcmd")).toBe('"\'\rcmd"');
  });

  it("neutralises the classic DDE payload", () => {
    const payload = "=cmd|'/C calc'!A0";
    const cell = csvCell(payload);
    expect(cell.startsWith("'")).toBe(true);
    expect(cell.startsWith("=")).toBe(false);
  });

  it("keeps the value readable rather than deleting it", () => {
    // A phone number legitimately starts with "+". The owner still needs to
    // read it; the apostrophe is hidden in the cell view.
    expect(csvCell("+44 20 7946 0958")).toBe("'+44 20 7946 0958");
  });

  it("only neutralises the FIRST character", () => {
    expect(csvCell("total = 1+1")).toBe("total = 1+1");
    expect(csvCell("a@b.com")).toBe("a@b.com");
  });

  it("combines neutralisation with quoting when both apply", () => {
    const cell = csvCell("=A1,B2");
    expect(cell).toBe('"\'=A1,B2"');
    // Quoted first character inside the quotes is the apostrophe, not "=".
    expect(cell[1]).toBe("'");
  });

  it("does not neutralise an empty string", () => {
    expect(csvCell("")).toBe("");
  });
});

describe("csvRow", () => {
  it("joins cells with commas and terminates with CRLF", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c\r\n");
  });

  it("keeps column alignment when a value contains a comma", () => {
    const row = csvRow(["Ada", "Acme, Inc.", "5"]);
    expect(row).toBe('Ada,"Acme, Inc.",5\r\n');
    // Three columns, not four: the embedded comma is inside a quoted field, so
    // only the two DELIMITING commas sit outside the quotes.
    const outsideQuotes = row.trimEnd().replace(/"[^"]*"/g, "");
    expect(outsideQuotes.split(",")).toHaveLength(3);
  });
});

describe("leadCsvHeader / leadCsvRow", () => {
  const lead = {
    id: "lead_123",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    name: "Ada Lovelace",
    email: "ada@example.com",
    companySize: "11-50",
    demoTitle: "Onboarding walkthrough",
    demoId: "demo-a",
    referrer: "https://example.com/pricing",
    consentAt: new Date("2026-09-01T10:00:00.000Z"),
    consentText: "I agree to be contacted about this product.",
    deliveryStatus: "hubspot:DELIVERED",
  };

  it("emits a header with the declared columns", () => {
    expect(leadCsvHeader()).toBe(`${LEAD_CSV_COLUMNS.join(",")}\r\n`);
  });

  it("emits one cell per column, in order", () => {
    const cells = leadCsvRow(lead).trimEnd().split(",");
    expect(cells).toHaveLength(LEAD_CSV_COLUMNS.length);
    expect(cells[0]).toBe("lead_123");
    expect(cells[2]).toBe("Ada Lovelace");
    expect(cells[3]).toBe("ada@example.com");
  });

  it("stays aligned when every field is hostile", () => {
    const row = leadCsvRow({
      ...lead,
      name: '=cmd|"/C calc"!A0',
      email: 'ada+"test",x@example.com',
      companySize: null,
      demoTitle: "Demo\nwith a newline",
      referrer: null,
      consentAt: null,
      consentText: 'I agree, and I said "yes".',
    });

    // Still exactly one record.
    expect(row.endsWith("\r\n")).toBe(true);
    // No cell escapes into a formula.
    expect(row.includes(",=")).toBe(false);
    expect(row.startsWith("=")).toBe(false);
    // The empty optional fields are empty cells, not "null".
    expect(row.includes("null")).toBe(false);
  });
});

describe("summarizeDeliveries", () => {
  it("spells out the empty case", () => {
    expect(summarizeDeliveries([])).toBe("not sent");
  });

  it("joins provider:status pairs", () => {
    expect(
      summarizeDeliveries([
        { provider: "hubspot", status: "DELIVERED" },
        { provider: "webhook", status: "FAILED" },
      ])
    ).toBe("hubspot:DELIVERED; webhook:FAILED");
  });

  it("survives being put through csvCell", () => {
    const summary = summarizeDeliveries([{ provider: "hubspot", status: "DELIVERED" }]);
    // No comma, so no quoting needed, and it never starts with a formula char.
    expect(csvCell(summary)).toBe(summary);
  });
});
