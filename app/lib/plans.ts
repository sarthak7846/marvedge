// Server-side source of truth for plan pricing.
// Never trust amounts sent by the client — derive them from the plan id here.

export const PAYMENT_CURRENCY = "USD";

export const PLANS = {
  pro: {
    id: "pro" as const,
    // Price in whole currency units (USD). Razorpay expects the smallest unit
    // (cents), so multiply by 100 when creating an order.
    amount: 49,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS;
}
