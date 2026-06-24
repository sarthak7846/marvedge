"use client";

export type ShareCta = {
  id: string;
  label: string;
  url: string;
  order: number;
};

function fireCtaClick(cta: ShareCta, demoId: string) {
  const payload = JSON.stringify({
    ctaId: cta.id,
    demoId,
    label: cta.label,
    referrer: document.referrer,
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/cta-clicks", blob)) {
        return;
      }
    }
  } catch {
    // fall through to fetch below
  }

  // Keep the request alive across the navigation triggered by the link click.
  fetch("/api/cta-clicks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export default function ShareCtaButtons({ ctas, demoId }: { ctas: ShareCta[]; demoId?: string }) {
  if (!ctas.length || !demoId) {
    return null;
  }

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      {ctas.map((cta) => (
        <a
          key={cta.id}
          href={cta.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fireCtaClick(cta, demoId)}
          className="rounded-full bg-[#2A1D5C] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(42,29,92,0.28)] transition hover:bg-[#3A2A78]"
        >
          {cta.label}
        </a>
      ))}
    </div>
  );
}
