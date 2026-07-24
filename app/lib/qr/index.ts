// Public surface of the QR engine. Import from here rather than reaching into
// the individual modules, so the internal split can change without a rename
// sweep across the app.

export { isShareQrEnabled } from "./flags";
export { MARVEDGE_MARK_ASPECT, MARVEDGE_MARK_DATA_URI } from "./mark";
export { renderQrSvg, renderQrSvgDataUri } from "./svg";
export { sanitizeQrOptions, toQrTargetUrl } from "./sanitize";
export {
  MARVEDGE_QR_PRESET,
  QR_ACCENT_MODULE_COLOR,
  QR_MODULE_COLOR,
  QR_SIZE_PRESETS,
  QR_STYLES,
  isQrStyle,
  resolveQrOptions,
  type QrSizePreset,
} from "./presets";
export { QR_MIN_CONTRAST_RATIO, contrastRatio, hasQrContrast } from "./contrast";
export type { QrRenderOptions, QrStyle, ResolvedQrOptions } from "./types";
