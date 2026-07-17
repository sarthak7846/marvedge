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

export async function registerCustomDomain(
  customHostname: string
): Promise<CloudflareHostnameResponse> {
  const CF_ZONE_ID = process.env.CF_ZONE_ID;
  const CF_AUTH_EMAIL = process.env.CF_AUTH_EMAIL;
  const CF_AUTH_KEY = process.env.CF_AUTH_KEY;

  if (!CF_ZONE_ID || !CF_AUTH_EMAIL || !CF_AUTH_KEY) {
    console.warn(
      "Cloudflare environment variables are missing. Using mock response for development."
    );
    // Return mock verification records for development/localhost testing
    return {
      success: true,
      id: "mock_cf_hostname_" + Math.random().toString(36).substring(7),
      status: "pending",
      sslStatus: "pending",
      dnsVerification: {
        cnameTarget: "hub-ingress.marvedge.io",
        txtRecordName: `_cf-custom-hostname.${customHostname}`,
        txtRecordValue: "vc-mock-ownership-verification-token-123456789",
        sslTxtName: `_acme-challenge.${customHostname}`,
        sslTxtValue: "vc-mock-ssl-acme-validation-token-abcdefgh",
      },
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
    const cnameTarget = "hub-ingress.marvedge.io";
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

  if (
    cloudflareId.startsWith("mock_cf_hostname_") ||
    !CF_ZONE_ID ||
    !CF_AUTH_EMAIL ||
    !CF_AUTH_KEY
  ) {
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

  if (
    cloudflareId.startsWith("mock_cf_hostname_") ||
    !CF_ZONE_ID ||
    !CF_AUTH_EMAIL ||
    !CF_AUTH_KEY
  ) {
    // Mock transitioning from pending to active for testing
    return {
      success: true,
      id: cloudflareId,
      status: "active",
      sslStatus: "active",
      dnsVerification: {
        cnameTarget: "hub-ingress.marvedge.io",
        txtRecordName: `_cf-custom-hostname.${customHostname}`,
        txtRecordValue: "vc-mock-ownership-verification-token-123456789",
        sslTxtName: `_acme-challenge.${customHostname}`,
        sslTxtValue: "vc-mock-ssl-acme-validation-token-abcdefgh",
      },
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
    const cnameTarget = "hub-ingress.marvedge.io";
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
