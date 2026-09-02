import {
  CARD_CLASS,
  CARD_HEADING_CLASS,
  FIELD_LABEL_CLASS,
  HINT_CLASS,
  TEXT_INPUT_CLASS,
} from "./styles";
import type { HubSettingsData } from "./useHubSettings";

interface HostingCardProps {
  form: HubSettingsData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export default function HostingCard({ form, onChange }: HostingCardProps) {
  return (
    <div className={`${CARD_CLASS} p-6 md:p-8 space-y-6`}>
      <h3 className={CARD_HEADING_CLASS}>Hosting &amp; Subdomains</h3>

      <div className="grid grid-cols-1 gap-6">
        {/* Subdomain */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subdomain" className={FIELD_LABEL_CLASS}>
            Marvedge Subdomain
          </label>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-[rgba(255,255,255,0.08)] focus-within:ring-2 focus-within:ring-[#7C5CFC]">
            <input
              type="text"
              id="subdomain"
              name="subdomainPrefix"
              value={form.subdomainPrefix}
              onChange={onChange}
              className="p-2.5 text-sm focus:outline-none w-full text-right font-medium"
              placeholder="my-company"
            />
            <span className="bg-gray-100 dark:bg-[#151229] px-3 flex items-center border-l dark:border-l-[rgba(255,255,255,0.08)] text-sm text-gray-500 font-medium whitespace-nowrap">
              -{form.userId ? form.userId.substring(0, 8) : "xxxxxxxx"}.marvedge.io
            </span>
          </div>
          <p className={HINT_CLASS}>Serve your demo hub instantly at this address.</p>
        </div>

        {/* Custom Domain */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customDomain" className={FIELD_LABEL_CLASS}>
            Custom Domain (CNAME / White-Label)
          </label>
          <input
            type="text"
            id="customDomain"
            name="customDomain"
            value={form.customDomain || ""}
            onChange={onChange}
            placeholder="e.g. demos.mycompany.com"
            className={`${TEXT_INPUT_CLASS} font-medium`}
          />
          <p className={HINT_CLASS}>
            Map your own custom domain by pointing its CNAME record to Marvedge.
          </p>
        </div>
      </div>
    </div>
  );
}
