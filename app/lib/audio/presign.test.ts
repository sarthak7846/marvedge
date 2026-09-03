import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://signed.example.test/presigned-url"),
}));

import { signClipUploadUrl } from "./presign";
import { AUDIO_UPLOAD_URL_TTL_SECONDS } from "./presign";

const mockGetSignedUrl = vi.mocked(getSignedUrl);

const ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_RAW_BUCKET",
] as const;

describe("signClipUploadUrl", () => {
  beforeAll(() => {
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_RAW_BUCKET = "raw";
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("signs a PutObjectCommand (PUT-only) scoped to exactly one object key", async () => {
    const url = await signClipUploadUrl({
      objectKey: "audio/demo-1/user-1/1700000000000-uuid.mp3",
      mimeType: "audio/mpeg",
    });

    expect(url).toBe("https://signed.example.test/presigned-url");
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);

    const [, command, options] = mockGetSignedUrl.mock.calls[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    const input = (command as PutObjectCommand).input;
    expect(input.Bucket).toBe("raw");
    expect(input.Key).toBe("audio/demo-1/user-1/1700000000000-uuid.mp3");
    expect(input.ContentType).toBe("audio/mpeg");
    expect(options?.expiresIn).toBe(AUDIO_UPLOAD_URL_TTL_SECONDS);
    expect(AUDIO_UPLOAD_URL_TTL_SECONDS).toBe(5 * 60);
  });

  it("honours an explicit expiresIn override", async () => {
    await signClipUploadUrl({
      objectKey: "audio/demo-1/user-1/x.wav",
      mimeType: "audio/wav",
      expiresIn: 90,
    });
    const [, , options] = mockGetSignedUrl.mock.calls.at(-1) as [
      unknown,
      unknown,
      { expiresIn: number },
    ];
    expect(options.expiresIn).toBe(90);
  });
});
