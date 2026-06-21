interface ExportBackgroundParams {
  selectedBackground: string | null;
  imageMap: Record<string, string>;
  localObjectUrl: string | null;
}

export function resolveExportBackgroundSelection({
  selectedBackground,
  imageMap,
  localObjectUrl,
}: ExportBackgroundParams) {
  let resolvedSelectedBackground = selectedBackground || "none";
  let resolvedCustomBackgroundUrl: string | null = localObjectUrl;

  if (
    !resolvedCustomBackgroundUrl &&
    resolvedSelectedBackground &&
    resolvedSelectedBackground !== "none" &&
    resolvedSelectedBackground !== "hidden" &&
    resolvedSelectedBackground !== "custom" &&
    !resolvedSelectedBackground.startsWith("color:") &&
    !resolvedSelectedBackground.startsWith("gradient:") &&
    imageMap[resolvedSelectedBackground]
  ) {
    const src = imageMap[resolvedSelectedBackground];
    resolvedSelectedBackground = "custom";
    resolvedCustomBackgroundUrl = src.startsWith("http")
      ? src
      : `${window.location.origin}${src.startsWith("/") ? src : `/${src}`}`;
  }

  return { resolvedSelectedBackground, resolvedCustomBackgroundUrl };
}

export function buildExportSpeed(playbackSpeed: number): string {
  return playbackSpeed === 1
    ? "Default"
    : String(playbackSpeed) === "0.75"
      ? "0.75"
      : String(playbackSpeed) === "1.25"
        ? "1.25"
        : String(playbackSpeed) === "1.5"
          ? "1.5"
          : String(playbackSpeed) === "1.75"
            ? "1.75"
            : "2";
}
