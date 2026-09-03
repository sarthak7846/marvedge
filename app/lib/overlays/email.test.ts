import { describe, expect, it } from "vitest";

import {
  FREE_EMAIL_DOMAINS,
  MAX_EMAIL_LENGTH,
  emailDomain,
  isDeniedDomain,
  isValidEmail,
  isWorkEmail,
  normalizeEmail,
} from "./email";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@Example.COM  ")).toBe("ada@example.com");
  });

  it("returns an empty string for anything that is not a string", () => {
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(42)).toBe("");
    expect(normalizeEmail({ email: "ada@example.com" })).toBe("");
  });
});

describe("emailDomain", () => {
  it("reads the part after the last @", () => {
    expect(emailDomain("ada@example.com")).toBe("example.com");
    // A quoted local part may legally contain an @; the LAST one splits.
    expect(emailDomain('"weird@local"@example.com')).toBe("example.com");
  });

  it("is empty when there is no @ at all", () => {
    expect(emailDomain("not-an-address")).toBe("");
    expect(emailDomain(undefined)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("ada@example.com")).toBe(true);
    expect(isValidEmail("ada.lovelace+demo@sub.example.co.uk")).toBe(true);
    expect(isValidEmail("a@b.io")).toBe(true);
  });

  it("accepts uppercase and surrounding whitespace", () => {
    expect(isValidEmail("  ADA@EXAMPLE.COM ")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
    expect(isValidEmail("ada")).toBe(false);
    expect(isValidEmail("ada@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("ada@example")).toBe(false);
    expect(isValidEmail("ada@.com")).toBe(false);
    expect(isValidEmail("ada@example..com")).toBe(false);
    expect(isValidEmail("ada example@test.com")).toBe(false);
    expect(isValidEmail("ada@exam ple.com")).toBe(false);
    expect(isValidEmail("ada@@example.com")).toBe(false);
    expect(isValidEmail("ada@-example.com")).toBe(false);
    expect(isValidEmail("ada@example-.com")).toBe(false);
  });

  it("rejects non-strings without throwing", () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(12345)).toBe(false);
    expect(isValidEmail(["ada@example.com"])).toBe(false);
  });

  it("rejects an address past the length bound", () => {
    const local = "a".repeat(MAX_EMAIL_LENGTH);
    expect(isValidEmail(`${local}@example.com`)).toBe(false);
  });
});

describe("isDeniedDomain", () => {
  it("matches a listed domain exactly", () => {
    expect(isDeniedDomain("gmail.com")).toBe(true);
    expect(isDeniedDomain("mail.ru")).toBe(true);
    expect(isDeniedDomain("yandex.ru")).toBe(true);
  });

  it("matches a SUBDOMAIN of a listed domain", () => {
    expect(isDeniedDomain("mail.gmail.com")).toBe(true);
    expect(isDeniedDomain("eu.mail.yahoo.com")).toBe(true);
  });

  it("does NOT match a look-alike that merely ends with the same characters", () => {
    // The naive endsWith("gmail.com") test waves both of these through.
    expect(isDeniedDomain("notgmail.com")).toBe(false);
    expect(isDeniedDomain("mygmail.com")).toBe(false);
  });

  it("does NOT match a domain that merely CONTAINS a listed one", () => {
    // The naive includes() test waves this through; it is a real company domain.
    expect(isDeniedDomain("gmail.com.example.org")).toBe(false);
  });

  it("is false for an empty domain and for ordinary company domains", () => {
    expect(isDeniedDomain("")).toBe(false);
    expect(isDeniedDomain("acme.com")).toBe(false);
    expect(isDeniedDomain("marvedge.com")).toBe(false);
  });
});

describe("isWorkEmail", () => {
  it("accepts an address on a company domain", () => {
    expect(isWorkEmail("ada@acme.com")).toBe(true);
    expect(isWorkEmail("ada@mail.acme.co.uk")).toBe(true);
  });

  it("rejects a free provider", () => {
    expect(isWorkEmail("ada@gmail.com")).toBe(false);
    expect(isWorkEmail("ada@yahoo.co.uk")).toBe(false);
    expect(isWorkEmail("ada@outlook.com")).toBe(false);
    expect(isWorkEmail("ada@proton.me")).toBe(false);
    expect(isWorkEmail("ada@icloud.com")).toBe(false);
  });

  it("rejects a subdomain of a free provider", () => {
    expect(isWorkEmail("ada@mail.gmail.com")).toBe(false);
  });

  it("rejects a known disposable domain", () => {
    expect(isWorkEmail("ada@mailinator.com")).toBe(false);
    expect(isWorkEmail("ada@yopmail.com")).toBe(false);
  });

  it("normalizes case and whitespace before deciding", () => {
    expect(isWorkEmail("  ADA@GMAIL.COM  ")).toBe(false);
    expect(isWorkEmail("  ADA@ACME.COM  ")).toBe(true);
  });

  it("rejects malformed input rather than treating it as a work address", () => {
    expect(isWorkEmail("")).toBe(false);
    expect(isWorkEmail("ada@")).toBe(false);
    expect(isWorkEmail("ada")).toBe(false);
    expect(isWorkEmail(undefined)).toBe(false);
    expect(isWorkEmail(null)).toBe(false);
    expect(isWorkEmail(7)).toBe(false);
  });
});

describe("FREE_EMAIL_DOMAINS", () => {
  it("is a data list of bare, lowercase, dotted domains", () => {
    // It is extended by appending a string. Guard the shape so a future edit
    // that pastes in "@gmail.com" or "GMAIL.COM" fails here rather than by
    // quietly never matching anything.
    for (const domain of FREE_EMAIL_DOMAINS) {
      expect(domain).toBe(domain.trim().toLowerCase());
      expect(domain).toContain(".");
      expect(domain.startsWith("@")).toBe(false);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(FREE_EMAIL_DOMAINS).size).toBe(FREE_EMAIL_DOMAINS.length);
  });
});
