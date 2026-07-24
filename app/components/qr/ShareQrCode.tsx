"use client";

import React from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { QR_SIZE_PRESETS, isShareQrEnabled } from "@/app/lib/qr";
import { useShareQr, type ShareQrDownloadPreset } from "./useShareQr";

export interface ShareQrCodeProps {
  /** The share URL to encode. It already exists — the QR never mints a link. */
  url: string;
  /** Demo title, used to name the downloaded files. */
  title?: string;
  /** Host-modal card styling: radius and border, so this matches its surroundings. */
  className?: string;
  /**
   * How a completed action is acknowledged. ExportResultModal already runs
   * react-hot-toast for its link copy; ShareModal deliberately uses inline text
   * and mounts no Toaster. Defaults to "inline", which is safe anywhere.
   */
  feedback?: "inline" | "toast";
}

/** How long an inline status line stays up. Matches ShareModal's copy feedback. */
const STATUS_MS = 1400;

/**
 * A scannable QR for a share link, with PNG/SVG download and copy-to-clipboard.
 *
 * All rendering comes from the engine in app/lib/qr — this file draws no QR
 * geometry and must not start to. One style only: the badge preset. There is
 * deliberately no style prop (see MARVEDGE_QR_PRESET in app/lib/qr/presets.ts).
 */
export default function ShareQrCode(props: ShareQrCodeProps) {
  // Guarded outside the card so the kill-switch costs nothing: with the flag off
  // there is no hook, no matrix build, and no empty card left behind.
  if (!isShareQrEnabled()) {
    return null;
  }
  return <ShareQrCard {...props} />;
}

function ShareQrCard({ url, title, className = "", feedback = "inline" }: ShareQrCodeProps) {
  const { svg, busy, canCopyImage, downloadPng, downloadSvg, copyImage } = useShareQr({
    url,
    title,
  });
  const [status, setStatus] = React.useState<string | null>(null);
  const statusTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    return () => window.clearTimeout(statusTimer.current);
  }, []);

  const report = React.useCallback(
    (message: string, failed = false) => {
      if (feedback === "toast") {
        if (failed) {
          toast.error(message);
        } else {
          toast.success(message);
        }
        return;
      }
      window.clearTimeout(statusTimer.current);
      setStatus(message);
      statusTimer.current = window.setTimeout(() => setStatus(null), STATUS_MS);
    },
    [feedback]
  );

  const handlePng = async (preset: ShareQrDownloadPreset) => {
    try {
      await downloadPng(preset);
      report(`QR downloaded — ${QR_SIZE_PRESETS[preset]}px PNG`);
    } catch (error) {
      console.error("QR PNG export failed:", error);
      report("Could not download the QR code", true);
    }
  };

  const handleSvg = async () => {
    try {
      await downloadSvg();
      report("QR downloaded — SVG");
    } catch (error) {
      console.error("QR SVG export failed:", error);
      report("Could not download the QR code", true);
    }
  };

  const handleCopy = async () => {
    try {
      const outcome = await copyImage();
      report(
        outcome === "copied" ? "QR copied to clipboard" : "QR downloaded — copying unsupported"
      );
    } catch (error) {
      console.error("QR copy failed:", error);
      report("Could not copy the QR code", true);
    }
  };

  return (
    <div className={`border bg-white p-4 ${className}`}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* The engine's markup goes in as-is. Nothing user-supplied reaches it:
            the URL is encoded into the module matrix, never interpolated into the
            SVG source (asserted in app/lib/qr/qr.test.ts). */}
        <div
          className="h-[160px] w-[160px] shrink-0 [&>svg]:h-full [&>svg]:w-full"
          role="img"
          aria-label={title ? `QR code for ${title}` : "QR code for the share link"}
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm font-semibold text-[#2D1F61]">Scan to open</p>
          <p className="mt-1 text-xs leading-relaxed text-[#8C82B4]">
            Point a phone camera at the code, or save it for a slide or a print.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <QrAction onClick={() => handlePng("download")} disabled={busy} icon={<Download />}>
              PNG {QR_SIZE_PRESETS.download}
            </QrAction>
            <QrAction onClick={() => handlePng("print")} disabled={busy} icon={<Download />}>
              PNG {QR_SIZE_PRESETS.print}
            </QrAction>
            <QrAction onClick={handleSvg} disabled={busy} icon={<Download />}>
              SVG
            </QrAction>
            <QrAction
              onClick={handleCopy}
              disabled={busy}
              icon={
                busy ? <Loader2 className="animate-spin" /> : canCopyImage ? <Copy /> : <Download />
              }
            >
              {canCopyImage ? "Copy" : "Save"}
            </QrAction>
          </div>

          {feedback === "inline" && status && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-[#6E56CF] sm:justify-start">
              <Check className="h-3 w-3" />
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** One compact action button. Kept local — nothing else needs this shape. */
function QrAction({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactElement<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E2DAFB] bg-[#F6F3FF] px-2 py-2 text-xs font-semibold text-[#7C5CFC] transition hover:bg-[#EAE5FB] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {React.cloneElement(icon, {
        className: `h-3.5 w-3.5 shrink-0 ${icon.props.className ?? ""}`,
      })}
      {children}
    </button>
  );
}
