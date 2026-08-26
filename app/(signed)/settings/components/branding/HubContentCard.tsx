import { CARD_CLASS, CARD_HEADING_CLASS, FIELD_LABEL_CLASS, TEXT_INPUT_CLASS } from "./styles";
import type { HubSettingsData } from "./useHubSettings";

interface HubContentCardProps {
  form: HubSettingsData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export default function HubContentCard({ form, onChange }: HubContentCardProps) {
  return (
    <div className={`${CARD_CLASS} p-6 md:p-8 space-y-6`}>
      <h3 className={CARD_HEADING_CLASS}>Hub Content</h3>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hubTitle" className={FIELD_LABEL_CLASS}>
            Hub Name / Title
          </label>
          <input
            type="text"
            id="hubTitle"
            name="hubTitle"
            value={form.hubTitle}
            onChange={onChange}
            placeholder="e.g. Acme Product Hub"
            className={TEXT_INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="hubDescription" className={FIELD_LABEL_CLASS}>
            Hub Description
          </label>
          <textarea
            id="hubDescription"
            name="hubDescription"
            value={form.hubDescription}
            onChange={onChange}
            placeholder="Introduce prospects and clients to your demo tours library..."
            rows={3}
            className={`${TEXT_INPUT_CLASS} resize-none`}
          />
        </div>
      </div>
    </div>
  );
}
