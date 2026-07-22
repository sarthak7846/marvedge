"use client";
// The client-side half of the WTM plan gate.
//
// Three places need to know whether the signed-in user is on a paid plan: the
// watermark controls, the camera-bubble controls, and the editor's WYSIWYG
// preview (which has to render what the *server* will bake in — the forced
// Marvedge badge for FREE, their own config for PRO). They all resolve it the
// same way, from the same endpoint the export modal uses, so the logic lives
// here once.
//
// This only decides what the UI shows. The real gates are server-side:
// app/api/jobs/create/route.ts re-resolves the watermark from the user's actual
// plan, and app/api/wtm/composite/route.ts rejects a non-PRO camera bubble.

import React from "react";
import axios from "axios";

import { isWtmAllowed } from "@/app/lib/wtm/access";

export interface WtmPlan {
  /** The raw plan string, or null while loading / if the lookup failed. */
  plan: string | null;
  /** True until the lookup settles — treat the user as un-gated meanwhile. */
  planLoading: boolean;
  /** PRO/ENTERPRISE. */
  isPro: boolean;
}

/**
 * @param enabled pass `false` where WTM is flag-gated off, so a disabled
 * feature costs no request — the flag is fixed at build time, so this never
 * flips mid-session.
 */
export function useWtmPlan(enabled: boolean = true): WtmPlan {
  const [plan, setPlan] = React.useState<string | null>(null);
  const [planLoading, setPlanLoading] = React.useState(enabled);

  // Same source of truth as the export modal's plan check.
  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    axios
      .get("/api/user/export-count")
      .then((res) => {
        if (!cancelled && res.data && typeof res.data.plan === "string") {
          setPlan(res.data.plan);
        }
      })
      .catch((err) => console.error("Could not fetch plan for WTM", err))
      .finally(() => {
        if (!cancelled) {
          setPlanLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { plan, planLoading, isPro: isWtmAllowed(plan) };
}
