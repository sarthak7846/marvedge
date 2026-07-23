"use client";

import React from "react";
import { VideoOff } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useEditorStore } from "@/app/store/editor/editorStore";
import { useWtmPlan } from "@/app/hooks/useWtmPlan";
import { isWtmPanelEnabled } from "@/app/lib/wtm/flags";
import {
  WTM_WATERMARK_MARGIN_PX,
  WTM_WEBCAM_MARGIN_PX,
  cornerOffsets,
  marginFraction,
} from "@/app/lib/wtm/geometry";
import { WTM_DEFAULT_BADGE_URL, resolveWatermarkForPlan } from "@/app/lib/wtm/watermark";
import { sanitizeWebcamConfig } from "@/app/lib/wtm/webcam";

interface WtmPreviewOverlayProps {
  /** Mirrors the preview player so the bubble runs at the editor's rate. */
  playbackSpeed: number;
}

/** How far the bubble may drift from the editor's playhead before re-seeking. */
const WEBCAM_SYNC_TOLERANCE_S = 0.35;

/**
 * WYSIWYG preview of both WTM overlays, drawn over the editor's video card in
 * DOM/CSS so what the user arranges is what the export bakes in.
 *
 * Geometry comes from app/lib/wtm/geometry.ts, the shared mirror of the two
 * ffmpeg renderers — same corner expressions, same 1080p-relative margins, and
 * both overlays sized against the frame HEIGHT (badge `scale`, bubble `size`).
 * `container-type: size` is what makes that possible: `100cqh` inside this layer
 * resolves to the frame's height, so a `calc(100cqh * scale)` badge is the exact
 * CSS counterpart of the worker's `scale2ref=h=main_h*scale`.
 *
 * The watermark is resolved by plan exactly the way app/api/jobs/create/route.ts
 * resolves it, so a FREE user previews the forced Marvedge badge they will
 * actually get, and a PRO user previews their own (or none). The bubble is only
 * previewed for PRO because /api/wtm/composite refuses it otherwise.
 *
 * Flag-gated on NEXT_PUBLIC_WTM_ENABLED — nothing renders when WTM is off.
 *
 * Two known approximations, both inherited from how the editor already previews:
 * the card stands in for the output canvas, so with a background selected the
 * overlays sit on the video's corners rather than the padded canvas's; and the
 * bubble is baked into the source *before* the export's zoom effects, so an
 * active zoom moves it in the output while the preview holds it in its corner.
 */
export default function WtmPreviewOverlay({ playbackSpeed }: WtmPreviewOverlayProps) {
  const { videoUrl, wtm, playing, currentTime } = useEditorStore(
    useShallow((s) => ({
      videoUrl: s.videoUrl,
      wtm: s.wtm,
      playing: s.playing,
      currentTime: s.currentTime,
    }))
  );
  const flagOn = isWtmPanelEnabled();
  const { isPro, planLoading } = useWtmPlan(flagOn);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  // A clip whose bucket is private (or that the browser cannot decode) still has
  // valid geometry to show, so a load failure downgrades to a poster, not to a
  // missing bubble.
  const [clipFailed, setClipFailed] = React.useState(false);

  // Both overlays wait on the plan: resolving early would show a FREE user's
  // forced badge for a beat to a PRO user who has removed theirs.
  const planKnown = flagOn && !planLoading;
  const watermark = planKnown ? resolveWatermarkForPlan(isPro, wtm?.watermark) : undefined;
  const webcam = planKnown ? sanitizeWebcamConfig(wtm?.webcam) : undefined;

  const clipUrl = webcam?.sourceUrl;
  // Non-PRO configs are previewable-but-not-exportable, so they are not
  // previewed: the composite route would reject them and the export would ship
  // without a bubble.
  const showBubble = Boolean(webcam?.enabled && clipUrl && isPro);
  const showClip = showBubble && !clipFailed;

  // A new take replaces sourceUrl — give the fresh clip its own chance to load.
  React.useEffect(() => {
    setClipFailed(false);
  }, [clipUrl]);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !showClip) {
      return;
    }
    el.playbackRate = playbackSpeed > 0 ? playbackSpeed : 1;
  }, [playbackSpeed, showClip]);

  // The camera clip was recorded in lockstep with the screen capture, so the
  // editor's playhead is also the bubble's. Correct only on real drift —
  // onProgress fires every 50ms and seeking on each tick would stutter.
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !showClip || !Number.isFinite(currentTime) || currentTime < 0) {
      return;
    }
    if (Math.abs(el.currentTime - currentTime) > WEBCAM_SYNC_TOLERANCE_S) {
      el.currentTime = currentTime;
    }
  }, [currentTime, showClip]);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !showClip) {
      return;
    }
    if (playing) {
      // Autoplay can still be refused (the element is muted, so rarely); the
      // bubble simply sits on its current frame if so.
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [playing, showClip]);

  const showWatermark = Boolean(watermark?.enabled);
  if (!flagOn || !videoUrl || (!showWatermark && !showBubble)) {
    return null;
  }

  const watermarkMargin = `calc(100cqh * ${marginFraction(WTM_WATERMARK_MARGIN_PX)})`;
  const bubbleMargin = `calc(100cqh * ${marginFraction(WTM_WEBCAM_MARGIN_PX)})`;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
      // Size containment is safe here: this layer is sized by `inset-0`, never
      // by its contents. It is what gives the children a `cqh` to measure from.
      style={{ containerType: "size", borderRadius: "1.25rem" }}
    >
      {watermark && showWatermark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={watermark.assetUrl || WTM_DEFAULT_BADGE_URL}
          alt=""
          style={{
            position: "absolute",
            // `w=-2` in the worker keeps the badge's aspect ratio off its
            // height; `width: auto` is the same rule.
            height: `calc(100cqh * ${watermark.scale})`,
            width: "auto",
            opacity: watermark.opacity,
            objectFit: "contain",
            ...cornerOffsets(watermark.position, watermarkMargin),
          }}
        />
      )}

      {showBubble && webcam && (
        <div
          style={{
            position: "absolute",
            width: `calc(100cqh * ${webcam.size})`,
            height: `calc(100cqh * ${webcam.size})`,
            // The compositor's center-square crop + circular alpha mask, in CSS:
            // `object-fit: cover` is the crop, the clipped 50% radius is the mask.
            borderRadius: "50%",
            overflow: "hidden",
            backgroundColor: "#1D1B2E",
            ...cornerOffsets(webcam.position, bubbleMargin),
          }}
        >
          {showClip ? (
            <video
              ref={videoRef}
              src={clipUrl}
              // Video-only by contract — the screen recording already carries
              // the audio, and an unmuted bubble would double it here too.
              muted
              playsInline
              preload="auto"
              onError={() => setClipFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#1D1B2E]">
              <VideoOff className="h-1/3 w-1/3 text-[#A594F9]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
