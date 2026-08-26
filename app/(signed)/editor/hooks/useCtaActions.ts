import type { Dispatch, SetStateAction } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import type { CtaItem } from "../apiTypes";

interface UseCtaActionsProps {
  savedDemoId: string | null;
  ctas: CtaItem[];
  setCtas: Dispatch<SetStateAction<CtaItem[]>>;
}

/**
 * CTA CRUD. Definitions live in the Cta table (not demo.editing) and are managed
 * over HTTP. Local state is updated optimistically and rolled back on failure.
 * The API enforces ownership (401 anon / 404 non-owner).
 */
export function useCtaActions({ savedDemoId, ctas, setCtas }: UseCtaActionsProps) {
  const handleAddCta = async (data: { label: string; url: string; placement?: string }) => {
    if (!savedDemoId) {
      toast.error("Save the demo before adding a call to action");
      return;
    }
    const placement = data.placement?.trim() ? data.placement.trim() : null;
    const tempId = `temp-${Date.now()}`;
    const optimistic: CtaItem = {
      id: tempId,
      label: data.label,
      url: data.url,
      placement,
      order: ctas.length,
    };
    setCtas([...ctas, optimistic]);
    try {
      const res = await axios.post(`/api/demos/${savedDemoId}/ctas`, {
        label: data.label,
        url: data.url,
        ...(placement ? { placement } : {}),
      });
      const created = res.data?.cta;
      setCtas((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? {
                id: String(created?.id ?? tempId),
                label: String(created?.label ?? optimistic.label),
                url: String(created?.url ?? optimistic.url),
                placement: created?.placement ?? optimistic.placement,
                order: typeof created?.order === "number" ? created.order : optimistic.order,
              }
            : c
        )
      );
      toast.success("Call to action added");
    } catch {
      setCtas((prev) => prev.filter((c) => c.id !== tempId));
      toast.error("Failed to add call to action");
    }
  };

  const handleUpdateCta = async (
    id: string,
    data: { label?: string; url?: string; placement?: string | null }
  ) => {
    const prevCtas = ctas;
    setCtas((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    try {
      await axios.patch(`/api/ctas/${id}`, data);
      toast.success("Call to action updated");
    } catch {
      setCtas(prevCtas);
      toast.error("Failed to update call to action");
    }
  };

  const handleDeleteCta = async (id: string) => {
    const prevCtas = ctas;
    setCtas((prev) => prev.filter((c) => c.id !== id));
    try {
      await axios.delete(`/api/ctas/${id}`);
      toast.success("Call to action removed");
    } catch {
      setCtas(prevCtas);
      toast.error("Failed to remove call to action");
    }
  };

  const handleReorderCta = async (id: string, direction: "up" | "down") => {
    const index = ctas.findIndex((c) => c.id === id);
    if (index === -1) {
      return;
    }
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= ctas.length) {
      return;
    }
    const prevCtas = ctas;
    const current = ctas[index];
    const neighbour = ctas[swapWith];
    const reordered = [...ctas];
    reordered[index] = { ...neighbour, order: current.order };
    reordered[swapWith] = { ...current, order: neighbour.order };
    setCtas(reordered);
    try {
      await Promise.all([
        axios.patch(`/api/ctas/${current.id}`, { order: neighbour.order }),
        axios.patch(`/api/ctas/${neighbour.id}`, { order: current.order }),
      ]);
    } catch {
      setCtas(prevCtas);
      toast.error("Failed to reorder call to action");
    }
  };

  return { handleAddCta, handleUpdateCta, handleDeleteCta, handleReorderCta };
}
