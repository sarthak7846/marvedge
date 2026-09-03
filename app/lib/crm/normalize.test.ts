import { describe, expect, it } from "vitest";

import {
  LEAD_SOURCE,
  UNKNOWN_COMPANY,
  collapseWhitespace,
  companyFromEmail,
  normalizeLead,
  sourceDescription,
  splitName,
} from "./normalize";
import { HUBSPOT_DEFAULT_COMPANY_SIZE_PROPERTY, toHubspotProperties } from "./hubspot";
import { SALESFORCE_LAST_NAME_FALLBACK, toWebToLeadFields } from "./salesforce";

const BASE_INPUT = {
  email: "ada@acme.com",
  name: "Ada Lovelace",
  companySize: "51-200",
  referrer: "https://news.example.com/post",
  createdAt: new Date("2026-08-28T09:30:00.000Z"),
  demoId: "demo_1",
  demoTitle: "Onboarding walkthrough",
  demoUrl: "https://marvedge.com/share/abc",
  consentText: "I agree to be contacted about this product.",
  consentAt: new Date("2026-08-28T09:29:58.000Z"),
};

describe("splitName", () => {
  it("returns two empty strings for nothing at all", () => {
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
    expect(splitName("   ")).toEqual({ firstName: "", lastName: "" });
    expect(splitName(null)).toEqual({ firstName: "", lastName: "" });
    expect(splitName(undefined)).toEqual({ firstName: "", lastName: "" });
  });

  it("puts a single word in the FIRST name, leaving the last name empty", () => {
    expect(splitName("Ada")).toEqual({ firstName: "Ada", lastName: "" });
  });

  it("splits two words on the space", () => {
    expect(splitName("Ada Lovelace")).toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });

  it("keeps everything after the first token together", () => {
    // The rule that matters: NOT "last token is the surname".
    expect(splitName("Ada Byron King")).toEqual({ firstName: "Ada", lastName: "Byron King" });
    expect(splitName("Jan van der Berg")).toEqual({ firstName: "Jan", lastName: "van der Berg" });
    expect(splitName("María del Carmen García")).toEqual({
      firstName: "María",
      lastName: "del Carmen García",
    });
  });

  it("handles unicode names without transforming them", () => {
    expect(splitName("张 伟")).toEqual({ firstName: "张", lastName: "伟" });
    expect(splitName("Ægir Þórsson")).toEqual({ firstName: "Ægir", lastName: "Þórsson" });
    // A single ideographic name is one token, so it becomes the first name.
    expect(splitName("张伟")).toEqual({ firstName: "张伟", lastName: "" });
  });

  it("collapses odd whitespace before splitting", () => {
    expect(splitName("  Ada\t\tLovelace \n")).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    expect(splitName("Ada  Byron   King")).toEqual({ firstName: "Ada", lastName: "Byron King" });
  });
});

describe("collapseWhitespace", () => {
  it("trims and collapses runs", () => {
    expect(collapseWhitespace("  a   b  ")).toBe("a b");
  });

  it("is empty for anything that is not a string", () => {
    expect(collapseWhitespace(null)).toBe("");
    expect(collapseWhitespace(undefined)).toBe("");
  });
});

describe("companyFromEmail", () => {
  it("uses the domain of a work address", () => {
    expect(companyFromEmail("ada@acme.com")).toBe("acme.com");
    expect(companyFromEmail("ada@Mail.ACME.co.uk")).toBe("mail.acme.co.uk");
  });

  it("uses the domain for a free-mail address rather than guessing a brand", () => {
    expect(companyFromEmail("ada@gmail.com")).toBe("gmail.com");
  });

  it("falls back when there is no domain", () => {
    expect(companyFromEmail("not-an-address")).toBe(UNKNOWN_COMPANY);
    expect(companyFromEmail("ada@")).toBe(UNKNOWN_COMPANY);
    expect(companyFromEmail(null)).toBe(UNKNOWN_COMPANY);
  });
});

describe("normalizeLead", () => {
  it("produces the provider-neutral record", () => {
    const contact = normalizeLead(BASE_INPUT);
    expect(contact).toMatchObject({
      email: "ada@acme.com",
      firstName: "Ada",
      lastName: "Lovelace",
      fullName: "Ada Lovelace",
      companySize: "51-200",
      company: "acme.com",
      demoId: "demo_1",
      source: LEAD_SOURCE,
    });
    expect(contact.submittedAt).toBe("2026-08-28T09:30:00.000Z");
    expect(contact.consentAt).toBe("2026-08-28T09:29:58.000Z");
  });

  it("lowercases and trims the address", () => {
    expect(normalizeLead({ ...BASE_INPUT, email: "  Ada@ACME.com " }).email).toBe("ada@acme.com");
  });

  it("turns empty optional fields into null rather than empty strings", () => {
    const contact = normalizeLead({
      ...BASE_INPUT,
      name: "",
      companySize: "   ",
      referrer: null,
      demoTitle: undefined,
      demoUrl: null,
      consentText: "",
      consentAt: null,
    });
    expect(contact.companySize).toBeNull();
    expect(contact.referrer).toBeNull();
    expect(contact.demoTitle).toBeNull();
    expect(contact.demoUrl).toBeNull();
    expect(contact.consentText).toBeNull();
    expect(contact.consentAt).toBeNull();
    expect(contact.firstName).toBe("");
    expect(contact.lastName).toBe("");
  });
});

describe("sourceDescription", () => {
  it("carries only owner-side context, never the lead's own details", () => {
    const description = sourceDescription(normalizeLead(BASE_INPUT));
    expect(description).toContain("Onboarding walkthrough");
    expect(description).toContain("https://marvedge.com/share/abc");
    expect(description).toContain("Company size: 51-200");
    expect(description).not.toContain("ada@acme.com");
    expect(description).not.toContain("Lovelace");
  });
});

describe("toHubspotProperties", () => {
  it("maps the standard properties", () => {
    const properties = toHubspotProperties(normalizeLead(BASE_INPUT));
    expect(properties.email).toBe("ada@acme.com");
    expect(properties.firstname).toBe("Ada");
    expect(properties.lastname).toBe("Lovelace");
    expect(properties.company).toBe("acme.com");
  });

  it("writes company size to the documented default property", () => {
    const properties = toHubspotProperties(normalizeLead(BASE_INPUT));
    expect(properties[HUBSPOT_DEFAULT_COMPANY_SIZE_PROPERTY]).toBe("51-200");
  });

  it("honours a fieldMap override for company size", () => {
    const properties = toHubspotProperties(normalizeLead(BASE_INPUT), {
      companySize: "custom_company_size",
    });
    expect(properties.custom_company_size).toBe("51-200");
    expect(properties[HUBSPOT_DEFAULT_COMPANY_SIZE_PROPERTY]).toBeUndefined();
  });

  it("omits empty properties rather than sending empty strings", () => {
    const properties = toHubspotProperties(
      normalizeLead({ ...BASE_INPUT, name: "Ada", companySize: null })
    );
    expect(properties.firstname).toBe("Ada");
    expect("lastname" in properties).toBe(false);
    expect(HUBSPOT_DEFAULT_COMPANY_SIZE_PROPERTY in properties).toBe(false);
  });

  it("only writes the notes and source properties when the fieldMap names them", () => {
    const contact = normalizeLead(BASE_INPUT);
    expect("notes" in toHubspotProperties(contact)).toBe(false);
    const mapped = toHubspotProperties(contact, { notes: "hs_notes", source: "hs_source" });
    expect(mapped.hs_notes).toContain("Onboarding walkthrough");
    expect(mapped.hs_source).toBe(LEAD_SOURCE);
  });
});

describe("toWebToLeadFields", () => {
  const credentials = { oid: "00D5f000000XXXX" };

  it("sends the org id and the required Salesforce fields", () => {
    const fields = toWebToLeadFields(credentials, normalizeLead(BASE_INPUT));
    expect(fields.oid).toBe("00D5f000000XXXX");
    expect(fields.email).toBe("ada@acme.com");
    expect(fields.first_name).toBe("Ada");
    expect(fields.last_name).toBe("Lovelace");
    // Lead.Company is REQUIRED by Web-to-Lead and the form never asks for it.
    expect(fields.company).toBe("acme.com");
    expect(fields.lead_source).toBe(LEAD_SOURCE);
  });

  it("puts a single-word name in last_name only, never duplicated", () => {
    const fields = toWebToLeadFields(credentials, normalizeLead({ ...BASE_INPUT, name: "Ada" }));
    expect(fields.last_name).toBe("Ada");
    expect("first_name" in fields).toBe(false);
  });

  it("falls back to the email local part when there is no name at all", () => {
    const fields = toWebToLeadFields(credentials, normalizeLead({ ...BASE_INPUT, name: "" }));
    expect(fields.last_name).toBe("ada");
  });

  it("falls back to a literal when there is neither a name nor a local part", () => {
    const fields = toWebToLeadFields(
      credentials,
      normalizeLead({ ...BASE_INPUT, name: "", email: "@acme.com" })
    );
    expect(fields.last_name).toBe(SALESFORCE_LAST_NAME_FALLBACK);
  });

  it("carries company size in the description by default", () => {
    const fields = toWebToLeadFields(credentials, normalizeLead(BASE_INPUT));
    expect(fields.description).toContain("Company size: 51-200");
    // No standard Web-to-Lead field for it, and an unknown field id is SILENTLY
    // DROPPED by Salesforce — so nothing is guessed.
    expect(Object.keys(fields)).not.toContain("number_of_employees");
  });

  it("uses a mapped custom field id for company size when one is configured", () => {
    const fields = toWebToLeadFields(credentials, normalizeLead(BASE_INPUT), {
      companySize: "00N5f000000AAAA",
    });
    expect(fields["00N5f000000AAAA"]).toBe("51-200");
  });

  it("includes retURL only when the connection configures one", () => {
    expect("retURL" in toWebToLeadFields(credentials, normalizeLead(BASE_INPUT))).toBe(false);
    const fields = toWebToLeadFields(
      { ...credentials, returnUrl: "https://acme.com/thanks" },
      normalizeLead(BASE_INPUT)
    );
    expect(fields.retURL).toBe("https://acme.com/thanks");
  });
});
