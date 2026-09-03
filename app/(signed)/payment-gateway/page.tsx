"use client";
import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import Script from "next/script";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PLANS, isPlanId } from "@/app/lib/plans";

function PaymentGatewayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const autoStartedRef = useRef(false);

  const planParam = searchParams.get("plan");
  const plan = isPlanId(planParam) ? planParam : null;
  const amount = plan ? PLANS[plan].amount : Number(searchParams.get("amount") || 0);

  const startCheckout = useCallback(
    async (planId: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planId }),
        });
        const data = await res.json();

        if (!res.ok || !data.id) {
          throw new Error(data.error || "Failed to create order");
        }

        if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
          throw new Error(
            "Razorpay key is not configured. Restart the dev server after setting NEXT_PUBLIC_RAZORPAY_KEY_ID in .env."
          );
        }

        const paymentData = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          order_id: data.id,
          amount: data.amount,
          currency: data.currency,
          name: "Marvedge",
          description: `Payment for ${planId} plan`,
          modal: {
            ondismiss: function () {
              alert("Payment cancelled.");
            },
          },
          handler: async function (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) {
            try {
              const verifyRes = await fetch("/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              });
              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                alert("Payment Successful and Verified!");
                router.push("/dashboard?subscribed=true");
              } else {
                alert("Payment verification failed.");
              }
            } catch {
              alert("Error verifying payment.");
            }
          },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payment = new (window as any).Razorpay(paymentData);
        payment.on("payment.failed", function () {
          alert("Payment failed. Please try again.");
        });
        payment.open();
      } catch (error) {
        console.error("Payment failed to initialize", error);
        alert("Failed to open payment gateway. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  // If this page is reached without a session, send the user to sign in and
  // return them here with the selected plan intact.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(
        "/auth/signin?callbackUrl=" +
          encodeURIComponent(window.location.pathname + window.location.search)
      );
    }
  }, [status, router]);

  // Auto-open the Razorpay modal once when arriving with a selected plan.
  useEffect(() => {
    if (!plan || status !== "authenticated" || autoStartedRef.current) {
      return;
    }
    autoStartedRef.current = true;

    // checkout.js may not have loaded yet — poll briefly before opening.
    const attempt = (tries = 0) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).Razorpay) {
        startCheckout(plan);
      } else if (tries < 50) {
        setTimeout(() => attempt(tries + 1), 200);
      } else {
        alert("Payment gateway failed to load. Please click Pay to retry.");
      }
    };
    attempt();
  }, [plan, status, startCheckout]);

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-2">Payment Gateway</h1>
      <p className="text-gray-600 mb-6">Complete your subscription payment to upgrade to PRO.</p>
      <Script type="text/javascript" src={"https://checkout.razorpay.com/v1/checkout.js"} />
      <div className="flex flex-col gap-4 mt-8">
        {amount > 0 && (
          <div className="text-lg font-medium text-gray-800">
            Total Amount: <span className="text-[#8C5BFF] font-bold">${amount}</span>
          </div>
        )}
        <button
          onClick={() => startCheckout(plan ?? "pro")}
          disabled={loading || amount <= 0}
          className="bg-[#8C5BFF] text-white px-6 py-3 rounded-md max-w-xs hover:bg-[#7a4fcf] font-semibold transition-colors disabled:opacity-50 mt-4 mx-auto"
        >
          {loading ? "Processing..." : `Pay $${amount}`}
        </button>
      </div>
    </div>
  );
}

export default function PaymentGateway() {
  return (
    <Suspense fallback={<div>Loading payment gateway...</div>}>
      <PaymentGatewayContent />
    </Suspense>
  );
}
