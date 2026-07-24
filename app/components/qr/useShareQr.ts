"use client";

import React from "react";

import { QR_SIZE_PRESETS, renderQrSvg, renderQrSvgDataUri, type QrSizePreset } from "@/app/lib/qr";

/** The two sizes the download menu offers. `screen` is what the card displays. */
export type ShareQrDownloadPreset = Extract<QrSizePreset, "download" | "print">;

/** What `copyImage` actually managed to do, so the caller can word its toast. */
export type ShareQrCopyOutcome = "copied" | "downloaded";

export interface UseShareQrOptions {
  /** The share URL to encode. It already exists — the QR never mints a link. */
  url: string;
  /** Demo title, used only to name the downloaded files. */
  title?: string;
}

export interface ShareQr {
  /** Inline-able SVG markup for the on-screen QR, memoized per url. */
  svg: string;
  /** True while a rasterize/copy round-trip is in flight. */
  busy: boolean;
  /** Whether this browser can put an image on the clipboard at all. */
  canCopyImage: boolean;
  downloadPng: (preset: ShareQrDownloadPreset) => Promise<void>;
  downloadSvg: () => Promise<void>;
  /** Copies the PNG, falling back to downloading it where the API is missing. */
  copyImage: () => Promise<ShareQrCopyOutcome>;
}

// Prefixed with "marvedge-qr-" at the call site, so this only needs to say what.
const FILENAME_FALLBACK = "demo";

/** Best-effort slug for a download filename — never empty, never path-ish. */
function slugify(title: string | undefined): string {
  const slug = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || FILENAME_FALLBACK;
}

/**
 * Rasterize an SVG `data:` URI into a PNG blob at `size` square.
 *
 * Untainted by construction: the mark is inlined as a `data:` URI in
 * app/lib/qr/mark.ts, so nothing in this path is cross-origin and `toBlob` cannot
 * throw a SecurityError. If it ever does, a remote `<img>` has crept into the
 * pipeline — find it rather than routing around it.
 */
async function svgToPngBlob(dataUri: string, size: number): Promise<Blob> {
  const image = new Image();
  // Firefox sizes an SVG `<img>` from these rather than from the drawImage box.
  image.width = size;
  image.height = size;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load the QR image"));
    image.src = dataUri;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get a 2D canvas context");
  }
  context.drawImage(image, 0, 0, size, size);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not encode the QR code as PNG"));
      }
    }, "image/png");
  });
}

/** Save a blob under `filename` via a throwaway object URL. */
function triggerDownload(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick — Safari needs the object URL to outlive the click.
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

/**
 * Owns everything stateful about a share QR so `<ShareQrCode />` stays
 * presentational — the same component/hook split as
 * app/components/editorSidebar/wtm/{WatermarkEditor.tsx,useWatermarkSettings.ts}.
 *
 * `renderQrSvg` is synchronous and quick, but each call builds a full matrix and
 * embeds the ~8 kB mark data URI, so the on-screen render is cached per size for
 * the life of a url. A share modal re-renders on every keystroke and toggle
 * around it; the QR should not be rebuilt for any of them.
 */
export function useShareQr({ url, title }: UseShareQrOptions): ShareQr {
  const [busy, setBusy] = React.useState(false);
  // Detected in an effect rather than during render: `ClipboardItem` is absent on
  // the server, and branching on it inline would desync hydration.
  const [canCopyImage, setCanCopyImage] = React.useState(false);

  React.useEffect(() => {
    setCanCopyImage(
      typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function"
    );
  }, []);

  // Keyed by url so switching demos can never serve a stale matrix, and bounded
  // to the entries of QR_SIZE_PRESETS.
  const cacheRef = React.useRef<{ url: string; bySize: Map<number, string> }>({
    url,
    bySize: new Map(),
  });

  const renderAt = React.useCallback(
    (size: number): string => {
      if (cacheRef.current.url !== url) {
        cacheRef.current = { url, bySize: new Map() };
      }
      const cached = cacheRef.current.bySize.get(size);
      if (cached !== undefined) {
        return cached;
      }
      const svg = renderQrSvg({ url, size });
      cacheRef.current.bySize.set(size, svg);
      return svg;
    },
    [url]
  );

  const svg = React.useMemo(() => renderAt(QR_SIZE_PRESETS.screen), [renderAt]);

  const filenameBase = React.useMemo(() => `marvedge-qr-${slugify(title)}`, [title]);

  const rasterize = React.useCallback(
    (size: number) => svgToPngBlob(renderQrSvgDataUri({ url, size }), size),
    [url]
  );

  /** Flip `busy` around a handler, so every button can disable itself uniformly. */
  const run = React.useCallback(async <T>(task: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await task();
    } finally {
      setBusy(false);
    }
  }, []);

  const savePng = React.useCallback(
    async (preset: ShareQrDownloadPreset) => {
      const size = QR_SIZE_PRESETS[preset];
      triggerDownload(await rasterize(size), `${filenameBase}-${size}.png`);
    },
    [rasterize, filenameBase]
  );

  const downloadPng = React.useCallback(
    (preset: ShareQrDownloadPreset) => run(() => savePng(preset)),
    [run, savePng]
  );

  const downloadSvg = React.useCallback(
    () =>
      run(async () => {
        // Vector apart from the mark, which is a 512px PNG occupying ~22% of the
        // code — so it is 1:1 or better up to ~2300px, and the modules themselves
        // stay crisp at any size. `print` is only the nominal width/height a
        // consumer sees before it scales the thing.
        const blob = new Blob([renderAt(QR_SIZE_PRESETS.print)], {
          type: "image/svg+xml;charset=utf-8",
        });
        triggerDownload(blob, `${filenameBase}.svg`);
      }),
    [run, renderAt, filenameBase]
  );

  const copyImage = React.useCallback(
    (): Promise<ShareQrCopyOutcome> =>
      run(async () => {
        if (!canCopyImage) {
          await savePng("download");
          return "downloaded";
        }
        try {
          // The blob is handed over as a promise on purpose: Safari only honours a
          // ClipboardItem constructed synchronously inside the user gesture.
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": rasterize(QR_SIZE_PRESETS.download) }),
          ]);
          return "copied";
        } catch {
          // Firefox and Safari disagree on what write() accepts and when the
          // permission is granted. A rejection here is a capability gap rather
          // than a bug, so land the user on the file anyway.
          await savePng("download");
          return "downloaded";
        }
      }),
    [run, canCopyImage, rasterize, savePng]
  );

  return { svg, busy, canCopyImage, downloadPng, downloadSvg, copyImage };
}
