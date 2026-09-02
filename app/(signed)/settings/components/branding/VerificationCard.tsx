import type { ReactNode } from "react";

import { CARD_CLASS, CARD_HEADING_CLASS, DNS_BOX_CLASS, DNS_STEP_LABEL_CLASS } from "./styles";
import type { HubSettingsData } from "./useHubSettings";

interface DnsRow {
  label: string;
  value: ReactNode;
  breakAll?: boolean;
}

function DnsRecordBlock({ title, rows }: { title: string; rows: DnsRow[] }) {
  return (
    <div className="space-y-1">
      <span className={DNS_STEP_LABEL_CLASS}>{title}</span>
      <div className={DNS_BOX_CLASS}>
        {rows.map((row) => (
          <div key={row.label} className={row.breakAll ? "break-all" : undefined}>
            <span className="text-gray-400 dark:text-gray-500">{row.label}:</span> {row.value}
          </div>
        ))}
      </div>
    </div>
  );
}

function DomainActiveNotice() {
  return (
    <div className="border border-green-200 dark:border-green-900/40 bg-green-50/55 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
      <h4 className="font-semibold text-green-800 dark:text-green-400 flex items-center gap-1">
        ✅ Domain Active &amp; Secure
      </h4>
      <p className="text-xs text-green-700 dark:text-green-500 leading-relaxed">
        Your custom domain is fully configured, verified, and secured with SSL. Your public showcase
        is active at this address.
      </p>
    </div>
  );
}

function DnsInstructions({
  dnsVerification,
}: {
  dnsVerification: HubSettingsData["dnsVerification"];
}) {
  return (
    <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
      <div className="border border-amber-200 dark:border-amber-900/40 bg-amber-50/55 dark:bg-amber-950/20 rounded-lg p-4 space-y-2">
        <h4 className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1">
          ⚠️ DNS Setup Required
        </h4>
        <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
          To point your custom domain securely, configure the following DNS records on your domain
          registrar (e.g. GoDaddy, Cloudflare, Namecheap).
        </p>
      </div>

      <DnsRecordBlock
        title="1. CNAME Record"
        rows={[
          { label: "Type", value: "CNAME" },
          { label: "Host", value: "@ or subdomain (e.g. demos)" },
          { label: "Points to", value: "hub-ingress.marvedge.io" },
        ]}
      />

      {dnsVerification?.txtRecordValue && (
        <DnsRecordBlock
          title="2. Ownership TXT Record"
          rows={[
            { label: "Type", value: "TXT" },
            { label: "Host", value: dnsVerification.txtRecordName, breakAll: true },
            { label: "Value", value: dnsVerification.txtRecordValue, breakAll: true },
          ]}
        />
      )}

      {dnsVerification?.sslTxtValue && (
        <DnsRecordBlock
          title="3. SSL Validation TXT Record"
          rows={[
            { label: "Type", value: "TXT" },
            { label: "Host", value: dnsVerification.sslTxtName, breakAll: true },
            { label: "Value", value: dnsVerification.sslTxtValue, breakAll: true },
          ]}
        />
      )}
    </div>
  );
}

interface VerificationCardProps {
  form: HubSettingsData;
  verifying: boolean;
  onVerify: () => void;
}

export default function VerificationCard({ form, verifying, onVerify }: VerificationCardProps) {
  return (
    <div className="space-y-6">
      <div className={`${CARD_CLASS} p-6 space-y-6 sticky top-6`}>
        <h3 className={CARD_HEADING_CLASS}>Verification Status</h3>

        {form.customDomain ? (
          <div className="space-y-6">
            {/* SSL Domain Status Badge */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#151229] border dark:border-[rgba(255,255,255,0.08)]">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Domain Configuration
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 break-all">
                  {form.customDomain}
                </span>
              </div>
              <span
                className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase border shrink-0 ${
                  form.sslStatus === "active"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                }`}
              >
                {form.sslStatus}
              </span>
            </div>

            {form.sslStatus === "active" ? (
              <DomainActiveNotice />
            ) : (
              <DnsInstructions dnsVerification={form.dnsVerification} />
            )}

            <button
              type="button"
              onClick={onVerify}
              disabled={verifying}
              className={`w-full py-2.5 bg-gray-100 dark:bg-[#151229] hover:bg-gray-200 dark:hover:bg-[#1d193d] text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.08)] transition-colors uppercase tracking-wider ${
                verifying ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {verifying ? "Refreshing status..." : "Refresh / Verify Status"}
            </button>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
            Configure a custom domain name to generate DNS verification instructions.
          </div>
        )}
      </div>
    </div>
  );
}
