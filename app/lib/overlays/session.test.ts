import { describe, expect, it } from "vitest";

import {
  SID_COOKIE,
  SID_MAX_AGE,
  applySessionCookie,
  readOrMintSessionId,
  type SessionCookieResponse,
} from "./session";

/** Minimal stand-in for NextRequest's cookie jar. */
function requestWith(cookies: Record<string, string>) {
  return {
    cookies: {
      get(name: string) {
        return name in cookies ? { value: cookies[name] } : undefined;
      },
    },
  };
}

interface RecordedCookie {
  name: string;
  value: string;
  options: { maxAge: number; path: string; httpOnly: boolean };
}

/** Minimal stand-in for NextResponse's cookie jar that records every write. */
function responseRecorder(): SessionCookieResponse & { written: RecordedCookie[] } {
  const written: RecordedCookie[] = [];
  return {
    written,
    cookies: {
      set(name, value, options) {
        written.push({ name, value, options });
        return undefined;
      },
    },
  };
}

describe("readOrMintSessionId", () => {
  it("returns an existing cookie value unchanged", () => {
    const existing = "11111111-2222-3333-4444-555555555555";
    const session = readOrMintSessionId(requestWith({ [SID_COOKIE]: existing }));
    expect(session.sessionId).toBe(existing);
    expect(session.isNew).toBe(false);
  });

  it("does not re-mint across repeated reads of the same cookie", () => {
    // The whole point of mv_sid: the same browser must count as one viewer.
    const req = requestWith({ [SID_COOKIE]: "stable-id" });
    expect(readOrMintSessionId(req).sessionId).toBe("stable-id");
    expect(readOrMintSessionId(req).sessionId).toBe("stable-id");
  });

  it("mints when the cookie is absent", () => {
    const session = readOrMintSessionId(requestWith({}));
    expect(session.isNew).toBe(true);
    expect(session.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("mints when the cookie is present but empty", () => {
    // An empty string is not a usable session id.
    expect(readOrMintSessionId(requestWith({ [SID_COOKIE]: "" })).isNew).toBe(true);
  });

  it("ignores other cookies", () => {
    expect(readOrMintSessionId(requestWith({ viewed_abc: "1", other: "x" })).isNew).toBe(true);
  });

  it("mints a distinct id per fresh browser", () => {
    const a = readOrMintSessionId(requestWith({}));
    const b = readOrMintSessionId(requestWith({}));
    expect(a.sessionId).not.toBe(b.sessionId);
  });
});

describe("applySessionCookie", () => {
  it("writes the cookie exactly once when the id was minted", () => {
    const res = responseRecorder();
    const session = readOrMintSessionId(requestWith({}));
    applySessionCookie(res, session);

    expect(res.written).toHaveLength(1);
    expect(res.written[0].name).toBe(SID_COOKIE);
    expect(res.written[0].value).toBe(session.sessionId);
  });

  it("writes the options /api/cta-clicks has always used", () => {
    const res = responseRecorder();
    applySessionCookie(res, readOrMintSessionId(requestWith({})));
    // httpOnly is false BY DESIGN — the client reads this value, which is also
    // why nothing may ever authorise on it.
    expect(res.written[0].options).toEqual({ maxAge: SID_MAX_AGE, path: "/", httpOnly: false });
    expect(SID_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });

  it("does not touch the response when the cookie already existed", () => {
    // Re-setting it would refresh the 1-year expiry on every heartbeat.
    const res = responseRecorder();
    applySessionCookie(res, readOrMintSessionId(requestWith({ [SID_COOKIE]: "existing" })));
    expect(res.written).toHaveLength(0);
  });
});
