export function resolveOverlayFontFamily(value: string): string {
  const v = (value || "").trim();
  switch (v) {
    case "Inter":
      return "var(--font-inter), ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    case "Roboto":
      return "var(--font-roboto), ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial";
    case "Poppins":
      return "var(--font-poppins), ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial";
    case "Caveat":
      return "var(--font-caveat), ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial";
    case "Georgia":
      return "Georgia, ui-serif, serif";
    case "Arial":
    default:
      return "Arial, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  }
}
