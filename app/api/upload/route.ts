import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth"; // FIX: require auth import
import { authOptions } from "@/app/lib/auth/options"; // FIX: load server auth options
import cloudinary from "@/app/lib/cloudinary";
import { isRateLimited } from "@/app/lib/audio/rateLimit"; // FIX: enable Redis rate limiter
import type { UploadApiOptions, UploadApiErrorResponse, UploadApiResponse } from "cloudinary";

export const runtime = "nodejs"; // FIX: force nodejs runtime for Redis

const MAX_SIZE = 10 * 1024 * 1024; // FIX: enforce 10MB max

// FIX: allow only safe image types including GIF
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  // FIX: block unauthenticated requests
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // FIX: limit to 10 uploads per minute per user
  if (await isRateLimited(`upload:${session.user.id}`, 10, 60)) {
    return NextResponse.json({ error: "Too many uploads (max 10 per minute)" }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    // FIX: ignore client-supplied preset and IDs, use server values only

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // FIX: reject oversized files before reading
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    // FIX: reject non-image files
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WEBP or GIF allowed" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // FIX: generate safe server-owned asset ID
    const safeUserId = session.user.id.replace(/[^\w-]/g, "_");
    const publicId = `profile_pics/${safeUserId}/${Date.now()}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadOptions: UploadApiOptions = {
        folder: "profile_pics",
        resource_type: "image", // FIX: lock to images only
        public_id: publicId, // FIX: prevent overwriting other users
        overwrite: false, // FIX: disable destructive overwrite
      };

      cloudinary.uploader
        .upload_stream(
          uploadOptions,
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error) {
              console.error("Cloudinary Upload Error:", error);
              reject(error);
            } else {
              console.log("Cloudinary Upload Success:", result?.secure_url);
              resolve(result);
            }
          }
        )
        .end(buffer);
    });

    return NextResponse.json(uploadResult);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to upload file";
    console.error("Upload API Error:", err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
