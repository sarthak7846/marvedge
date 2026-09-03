import { describe, expect, it } from "vitest";

import {
  assertTransition,
  canTransition,
  isProcessingStatus,
  PROCESSING_STATUSES,
  TRIMABLE_STATUSES,
} from "./status";

describe("canTransition", () => {
  it("moves UPLOADING → PROCESSING", () => {
    expect(canTransition("UPLOADING", "PROCESSING")).toBe(true);
  });

  it("moves PROCESSING → READY and → FAILED", () => {
    expect(canTransition("PROCESSING", "READY")).toBe(true);
    expect(canTransition("PROCESSING", "FAILED")).toBe(true);
  });

  it("moves READY → TRIM_PROCESSING (trim request)", () => {
    expect(canTransition("READY", "TRIM_PROCESSING")).toBe(true);
  });

  it("moves TRIM_PROCESSING → READY and → FAILED", () => {
    expect(canTransition("TRIM_PROCESSING", "READY")).toBe(true);
    expect(canTransition("TRIM_PROCESSING", "FAILED")).toBe(true);
  });

  it("allows FAILED → TRIM_PROCESSING (re-trim retry)", () => {
    expect(canTransition("FAILED", "TRIM_PROCESSING")).toBe(true);
  });

  it("blocks illegal moves", () => {
    expect(canTransition("READY", "PROCESSING")).toBe(false);
    expect(canTransition("UPLOADING", "READY")).toBe(false);
    expect(canTransition("PROCESSING", "TRIM_PROCESSING")).toBe(false);
    expect(canTransition("FAILED", "READY")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("does not throw for a legal transition", () => {
    expect(() => assertTransition("UPLOADING", "PROCESSING")).not.toThrow();
  });

  it("throws for an illegal transition", () => {
    expect(() => assertTransition("READY", "PROCESSING")).toThrow(
      "Invalid AudioClip status transition"
    );
  });
});

describe("isProcessingStatus", () => {
  it("flags background-job statuses", () => {
    for (const status of PROCESSING_STATUSES) {
      expect(isProcessingStatus(status)).toBe(true);
    }
  });

  it("does not flag READY or FAILED", () => {
    expect(isProcessingStatus("READY")).toBe(false);
    expect(isProcessingStatus("FAILED")).toBe(false);
  });
});

describe("TRIMABLE_STATUSES", () => {
  it("allows READY and FAILED to be re-trimmed", () => {
    expect(TRIMABLE_STATUSES).toEqual(["READY", "FAILED"]);
  });
});
