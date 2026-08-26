// Unsigned Cloudinary upload helper (testing mode).
//
// The shared API key on this account lacks upload ("create") permission, but
// unsigned uploads through the `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` preset
// are allowed. Uses native fetch/FormData — no SDK signing involved.

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";

export type CloudinaryResourceType = "video" | "image" | "raw";

export function cloudinaryResourceTypeFor(contentType: string): CloudinaryResourceType {
  const normalized = contentType.toLowerCase();
  if (normalized.startsWith("video/") || normalized.startsWith("audio/")) {
    return "video";
  }
  if (normalized.startsWith("image/")) {
    return "image";
  }
  return "raw";
}

export function isCloudinaryUploadConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

export class CloudinaryUploadError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "CloudinaryUploadError";
    this.status = status;
  }
}

/** Upload a buffer to Cloudinary via the unsigned preset. Returns the secure URL. */
export async function cloudinaryUploadBuffer(opts: {
  buffer: Buffer;
  contentType: string;
  folder: string;
  filename?: string;
}): Promise<string> {
  if (!isCloudinaryUploadConfigured()) {
    throw new CloudinaryUploadError(
      "Missing CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET",
      500
    );
  }

  const resourceType = cloudinaryResourceTypeFor(opts.contentType);
  const form = new FormData();
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", opts.folder);
  form.append(
    "file",
    new Blob([new Uint8Array(opts.buffer)], { type: opts.contentType }),
    opts.filename || "upload"
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: form }
  );

  const payload = (await response.json().catch(() => null)) as {
    secure_url?: string;
    error?: { message?: string };
  } | null;

  if (!response.ok || !payload?.secure_url) {
    const message = payload?.error?.message || `Cloudinary upload failed (${response.status})`;
    console.error("[cloudinary] upload failed:", message);
    throw new CloudinaryUploadError(message, response.status === 401 ? 500 : response.status);
  }

  return payload.secure_url;
}
