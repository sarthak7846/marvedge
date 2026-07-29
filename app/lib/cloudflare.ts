import { HUB_CNAME_TARGET } from "./hubDomain";

export interface CloudflareHostnameResponse {
  success: boolean;
  id?: string;
  status?: string;
  sslStatus?: string;
  dnsVerification?: {
    cnameTarget: string;
    txtRecordName?: string;
    txtRecordValue?: string;
    sslTxtName?: string;
    sslTxtValue?: string;
  };
  error?: string;
}

const MOCK_ID_PREFIX = "mock_cf_hostname_";

/**
 * Cloudflare is only mocked outside production. In production, missing
 * credentials must surface as an error — otherwise a customer is told their
 * domain is registered and SSL is active when nothing was ever provisioned.
 */
function isMockable(): boolean {
  return process.env.NODE_ENV !== "production";
}

const MISSING_CREDENTIALS_ERROR =
  "Custom domains are not configured on this deployment. Set CF_ZONE_ID, CF_AUTH_EMAIL and CF_AUTH_KEY.";

function mockVerification(customHostname: string) {
  return {
    cnameTarget: HUB_CNAME_TARGET,
    txtRecordName: `_cf-custom-hostname.${customHostname}`,
    txtRecordValue: "vc-mock-ownership-verification-token-123456789",
    sslTxtName: `_acme-challenge.${customHostname}`,
    sslTxtValue: "vc-mock-ssl-acme-validation-token-abcdefgh",
  };
}

export async function registerCustomDomain(
  customHostname: string
): Promise<CloudflareHostnameResponse> {
  const CF_ZONE_ID = process.env.CF_ZONE_ID;
  const CF_AUTH_EMAIL = process.env.CF_AUTH_EMAIL;
  const CF_AUTH_KEY = process.env.CF_AUTH_KEY;

  if (!CF_ZONE_ID || !CF_AUTH_EMAIL || !CF_AUTH_KEY) {
    if (!isMockable()) {
      console.error(
        "Cloudflare environment variables are missing; refusing to fake a custom hostname registration in production."
      );
      return { success: false, error: MISSING_CREDENTIALS_ERROR };
    }

    console.warn(
      "Cloudflare environment variables are missing. Using mock response for development."
    );
    // Return mock verification records for development/localhost testing
    return {
      success: true,
      id: MOCK_ID_PREFIX + Math.random().toString(36).substring(7),
      status: "pending",
      sslStatus: "pending",
      dnsVerification: mockVerification(customHostname),
    };
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames`;
  const payload = {
    hostname: customHostname,
    ssl: {
      method: "txt", // Use txt method for SSL validation (DNS-based)
      type: "dv",
      settings: {
        http2: "on",
        min_tls_version: "1.3",
      },
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Auth-Email": CF_AUTH_EMAIL,
        "X-Auth-Key": CF_AUTH_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Cloudflare custom hostname registration failed:", errText);
      return { success: false, error: errText };
    }

    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.errors?.[0]?.message || "Cloudflare API error" };
    }

    const result = data.result;

    // Extract DNS verification records
    const cnameTarget = HUB_CNAME_TARGET;
    const txtRecordName =
      result.ownership_verification?.name || `_cf-custom-hostname.${customHostname}`;
    const txtRecordValue = result.ownership_verification?.value || "";

    let sslTxtName = "";
    let sslTxtValue = "";
    if (result.ssl?.validation_records?.[0]) {
      sslTxtName = result.ssl.validation_records[0].txt_name || "";
      sslTxtValue = result.ssl.validation_records[0].txt_value || "";
    }

    return {
      success: true,
      id: result.id,
      status: result.status,
      sslStatus: result.ssl?.status,
      dnsVerification: {
        cnameTarget,
        txtRecordName,
        txtRecordValue,
        sslTxtName,
        sslTxtValue,
      },
    };
  } catch (error) {
    console.error("Cloudflare registration exception:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to contact Cloudflare",
    };
  }
}

export async function deleteCustomDomain(
  cloudflareId: string
): Promise<{ success: boolean; error?: string }> {
  const CF_ZONE_ID = process.env.CF_ZONE_ID;
  const CF_AUTH_EMAIL = process.env.CF_AUTH_EMAIL;
  const CF_AUTH_KEY = process.env.CF_AUTH_KEY;

  if (!cloudflareId) {
    return { success: true };
  }

  if (cloudflareId.startsWith(MOCK_ID_PREFIX)) {
    console.log("Mock deleting custom hostname:", cloudflareId);
    return { success: true };
  }

  if (!CF_ZONE_ID || !CF_AUTH_EMAIL || !CF_AUTH_KEY) {
    if (!isMockable()) {
      // A real hostname exists in Cloudflare but we cannot reach the API to
      // remove it — report the failure so the orphan is not silently ignored.
      console.error("Cloudflare credentials missing; cannot delete hostname", cloudflareId);
      return { success: false, error: MISSING_CREDENTIALS_ERROR };
    }
    console.log("Mock deleting custom hostname:", cloudflareId);
    return { success: true };
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames/${cloudflareId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "X-Auth-Email": CF_AUTH_EMAIL,
        "X-Auth-Key": CF_AUTH_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Cloudflare custom hostname deletion failed:", errText);
      return { success: false, error: errText };
    }

    const data = await response.json();
    return { success: data.success, error: data.errors?.[0]?.message };
  } catch (error) {
    console.error("Cloudflare deletion exception:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getCustomDomainStatus(
  cloudflareId: string,
  customHostname: string
): Promise<CloudflareHostnameResponse> {
  const CF_ZONE_ID = process.env.CF_ZONE_ID;
  const CF_AUTH_EMAIL = process.env.CF_AUTH_EMAIL;
  const CF_AUTH_KEY = process.env.CF_AUTH_KEY;

  if (!cloudflareId) {
    return { success: false, error: "Missing Cloudflare ID" };
  }

  const isMock =
    cloudflareId.startsWith(MOCK_ID_PREFIX) || !CF_ZONE_ID || !CF_AUTH_EMAIL || !CF_AUTH_KEY;

  if (isMock && !isMockable()) {
    // Never report a mocked hostname as verified in production.
    return { success: false, error: MISSING_CREDENTIALS_ERROR };
  }

  if (isMock) {
    // Mock transitioning from pending to active for testing
    return {
      success: true,
      id: cloudflareId,
      status: "active",
      sslStatus: "active",
      dnsVerification: mockVerification(customHostname),
    };
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames/${cloudflareId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Email": CF_AUTH_EMAIL,
        "X-Auth-Key": CF_AUTH_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: errText };
    }

    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.errors?.[0]?.message };
    }

    const result = data.result;
    const cnameTarget = HUB_CNAME_TARGET;
    const txtRecordName =
      result.ownership_verification?.name || `_cf-custom-hostname.${customHostname}`;
    const txtRecordValue = result.ownership_verification?.value || "";

    let sslTxtName = "";
    let sslTxtValue = "";
    if (result.ssl?.validation_records?.[0]) {
      sslTxtName = result.ssl.validation_records[0].txt_name || "";
      sslTxtValue = result.ssl.validation_records[0].txt_value || "";
    }

    return {
      success: true,
      id: result.id,
      status: result.status,
      sslStatus: result.ssl?.status,
      dnsVerification: {
        cnameTarget,
        txtRecordName,
        txtRecordValue,
        sslTxtName,
        sslTxtValue,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export interface CloudflareHostnameSummary {
  id: string;
  hostname: string;
  status?: string;
  sslStatus?: string;
}

/**
 * Enumerate every custom hostname on the zone. Used by the reconciliation sweep
 * to spot hostnames that still route to us but no longer have a hub behind them
 * (PRD §4.4 — a deleted account must not leave its subdomain live).
 */
export async function listCustomHostnames(): Promise<
  { success: true; hostnames: CloudflareHostnameSummary[] } | { success: false; error: string }
> {
  const CF_ZONE_ID = process.env.CF_ZONE_ID;
  const CF_AUTH_EMAIL = process.env.CF_AUTH_EMAIL;
  const CF_AUTH_KEY = process.env.CF_AUTH_KEY;

  if (!CF_ZONE_ID || !CF_AUTH_EMAIL || !CF_AUTH_KEY) {
    // Nothing to reconcile against without credentials; not an error in dev.
    return isMockable()
      ? { success: true, hostnames: [] }
      : { success: false, error: MISSING_CREDENTIALS_ERROR };
  }

  const hostnames: CloudflareHostnameSummary[] = [];
  const perPage = 50;
  // Bounded so a huge zone can never spin the cron indefinitely.
  const maxPages = 20;

  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames?page=${page}&per_page=${perPage}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Auth-Email": CF_AUTH_EMAIL,
          "X-Auth-Key": CF_AUTH_KEY,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return { success: false, error: await response.text() };
      }

      const data = await response.json();
      if (!data.success) {
        return { success: false, error: data.errors?.[0]?.message || "Cloudflare API error" };
      }

      const batch = (data.result || []) as Array<{
        id: string;
        hostname: string;
        status?: string;
        ssl?: { status?: string };
      }>;

      for (const row of batch) {
        hostnames.push({
          id: row.id,
          hostname: row.hostname,
          status: row.status,
          sslStatus: row.ssl?.status,
        });
      }

      if (batch.length < perPage) {
        break;
      }
    }

    return { success: true, hostnames };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
