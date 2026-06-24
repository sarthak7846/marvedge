import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from "lucide-react";
import type { CtaItem } from "@/app/(signed)/editor/apiTypes";

interface CtaPanelProps {
  ctas?: CtaItem[];
  onAddCta?: (data: { label: string; url: string; placement?: string }) => void | Promise<void>;
  onUpdateCta?: (
    id: string,
    data: { label?: string; url?: string; placement?: string | null }
  ) => void | Promise<void>;
  onDeleteCta?: (id: string) => void | Promise<void>;
  onReorderCta?: (id: string, direction: "up" | "down") => void | Promise<void>;
}

const inputClass =
  "w-full border border-[#ede7fa] bg-[#F6F3FF] rounded-lg px-3 py-2 text-sm text-[#7C5CFC] placeholder:text-[#B0A5D3] focus:outline-none focus:ring-2 focus:ring-[#A594F9]";

const iconBtnClass =
  "p-1.5 rounded-md text-[#7C5CFC] hover:bg-[#EDE7FA] transition disabled:opacity-40 disabled:cursor-not-allowed";

const CtaPanel: React.FC<CtaPanelProps> = ({
  ctas = [],
  onAddCta,
  onUpdateCta,
  onDeleteCta,
  onReorderCta,
}) => {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [placement, setPlacement] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editPlacement, setEditPlacement] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canAdd = label.trim().length > 0 && url.trim().length > 0 && !adding;

  const handleAdd = async () => {
    if (!canAdd) {
      return;
    }
    setAdding(true);
    try {
      await onAddCta?.({
        label: label.trim(),
        url: url.trim(),
        placement: placement.trim() || undefined,
      });
      setLabel("");
      setUrl("");
      setPlacement("");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (cta: CtaItem) => {
    setConfirmDeleteId(null);
    setEditingId(cta.id);
    setEditLabel(cta.label);
    setEditUrl(cta.url);
    setEditPlacement(cta.placement ?? "");
  };

  const saveEdit = async (id: string) => {
    if (!editLabel.trim() || !editUrl.trim() || savingEdit) {
      return;
    }
    setSavingEdit(true);
    try {
      await onUpdateCta?.(id, {
        label: editLabel.trim(),
        url: editUrl.trim(),
        placement: editPlacement.trim() ? editPlacement.trim() : null,
      });
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="control-block-label text-lg font-bold text-[#A594F9] mb-4">
          Call to action
        </h2>

        <div className="space-y-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Button label (e.g. Book a demo)"
            className={inputClass}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className={inputClass}
          />
          <input
            type="text"
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            placeholder="Placement (optional)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="w-full rounded-lg bg-[#8A76FC] text-white py-2 text-sm font-semibold hover:bg-[#7C5CFC] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {adding ? "Adding..." : "Add call to action"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#6B6B6B] mb-2">Your call to actions</h3>
        {ctas.length === 0 ? (
          <p className="text-sm text-gray-400">No call to actions yet.</p>
        ) : (
          <ul className="space-y-2">
            {ctas.map((cta, index) => (
              <li key={cta.id} className="rounded-lg border border-[#ede7fa] bg-[#F6F3FF] p-3">
                {editingId === cta.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Button label"
                      className={inputClass}
                    />
                    <input
                      type="url"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="https://example.com"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={editPlacement}
                      onChange={(e) => setEditPlacement(e.target.value)}
                      placeholder="Placement (optional)"
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(cta.id)}
                        disabled={!editLabel.trim() || !editUrl.trim() || savingEdit}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#8A76FC] text-white py-1.5 text-sm font-semibold hover:bg-[#7C5CFC] transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Check size={16} />
                        {savingEdit ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#8A76FC] text-[#8A76FC] py-1.5 text-sm font-semibold hover:bg-[#EDE7FA] transition"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#7C5CFC] truncate">
                          {cta.label}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{cta.url}</div>
                        {cta.placement ? (
                          <div className="text-[11px] text-gray-400 truncate">{cta.placement}</div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => onReorderCta?.(cta.id, "up")}
                          className={iconBtnClass}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={index === ctas.length - 1}
                          onClick={() => onReorderCta?.(cta.id, "down")}
                          className={iconBtnClass}
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Edit call to action"
                          onClick={() => startEdit(cta)}
                          className={iconBtnClass}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete call to action"
                          onClick={() => setConfirmDeleteId(cta.id)}
                          className={`${iconBtnClass} hover:text-red-600`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {confirmDeleteId === cta.id ? (
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#ede7fa] pt-2">
                        <span className="text-xs text-gray-600">Delete this CTA?</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              onDeleteCta?.(cta.id);
                            }}
                            className="rounded-md bg-red-500 text-white px-2 py-1 text-xs font-semibold hover:bg-red-600 transition"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md border border-gray-300 text-gray-600 px-2 py-1 text-xs font-semibold hover:bg-gray-100 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CtaPanel;
