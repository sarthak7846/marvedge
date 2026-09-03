import { afterEach, describe, expect, it, vi } from "vitest";

import { postBeacon } from "./beacon";

const URL_UNDER_TEST = "/api/v3/events";
const PAYLOAD = JSON.stringify({ demoId: "demo-1", events: [] });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type SendBeacon = (url: string, data?: BodyInit | null) => boolean;
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function stubBeacon(result: boolean | (() => boolean)) {
  const impl = typeof result === "function" ? result : () => result;
  const sendBeacon = vi.fn<SendBeacon>(() => impl());
  vi.stubGlobal("navigator", { sendBeacon });
  return sendBeacon;
}

function stubFetch() {
  const fetchMock = vi.fn<Fetch>(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("postBeacon", () => {
  it("uses sendBeacon and does not also fetch when the browser accepts it", () => {
    const sendBeacon = stubBeacon(true);
    const fetchMock = stubFetch();

    expect(postBeacon(URL_UNDER_TEST, PAYLOAD)).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the payload as an application/json blob", async () => {
    const sendBeacon = stubBeacon(true);
    stubFetch();

    postBeacon(URL_UNDER_TEST, PAYLOAD);

    const [url, data] = sendBeacon.mock.calls[0];
    const body = data as Blob;
    expect(url).toBe(URL_UNDER_TEST);
    expect(body.type).toBe("application/json");
    await expect(body.text()).resolves.toBe(PAYLOAD);
  });

  it("falls back to a keepalive fetch when sendBeacon refuses the payload", async () => {
    // THE REASON THE FALLBACK EXISTS: sendBeacon returns false without throwing
    // once the per-origin queue budget is spent, which happens under exactly the
    // load where losing telemetry matters most.
    const sendBeacon = stubBeacon(false);
    const fetchMock = stubFetch();

    expect(postBeacon(URL_UNDER_TEST, PAYLOAD)).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL_UNDER_TEST);
    expect(init?.method).toBe("POST");
    expect(init?.keepalive).toBe(true);
    expect(init?.body).toBe(PAYLOAD);
  });

  it("falls back to fetch when sendBeacon throws", () => {
    const fetchMock = stubFetch();
    stubBeacon(() => {
      throw new Error("blocked");
    });

    expect(postBeacon(URL_UNDER_TEST, PAYLOAD)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to fetch where sendBeacon does not exist at all", () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = stubFetch();

    expect(postBeacon(URL_UNDER_TEST, PAYLOAD)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejected fetch instead of leaving an unhandled rejection", async () => {
    // This is called from a pagehide handler. There is nowhere to put an error,
    // and an unhandled rejection during unload is a console error the viewer of
    // a customer's own domain would see.
    stubBeacon(false);
    vi.stubGlobal(
      "fetch",
      vi.fn<Fetch>(() => Promise.reject(new Error("offline")))
    );

    expect(() => postBeacon(URL_UNDER_TEST, PAYLOAD)).not.toThrow();
    await Promise.resolve();
  });

  it("reports failure rather than throwing when no transport exists", () => {
    // Imported on the server, or called in an environment with neither API.
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("fetch", undefined);

    expect(postBeacon(URL_UNDER_TEST, PAYLOAD)).toBe(false);
  });
});
