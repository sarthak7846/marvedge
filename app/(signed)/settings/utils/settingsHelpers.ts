export type SettingsForm = {
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
  location: string;
  website: string;
  timezone: string;
  image: string;
};

export type UserRecord = {
  name?: string | null;
  email?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  timezone?: string | null;
  image?: string | null;
};

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export const mapUserToForm = (user: UserRecord): SettingsForm => ({
  firstName: user.name?.split(" ")[0] || "",
  lastName: user.name?.split(" ").slice(1).join(" ") || "",
  email: user.email || "",
  bio: user.bio || "",
  location: user.location || "",
  website: user.website || "",
  timezone: user.timezone || "",
  image: user.image || "",
});

export const fetchUser = async (): Promise<UserRecord | null> => {
  const res = await fetch("/api/user/get");
  const data = await res.json();
  return data.user ?? null;
};

export const uploadProfilePhoto = async (photoFile: File): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append("file", photoFile);
  formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

  const uploadRes = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const uploadData = await uploadRes.json();

  console.log("Upload Status:", uploadRes.status);
  console.log("Upload Data:", uploadData);

  if (!uploadRes.ok) {
    console.error("Upload failed with status:", uploadRes.status);
    return { ok: false, error: uploadData.error || "Failed to upload photo" };
  }

  if (!uploadData.secure_url) {
    console.error("No secure_url in response:", uploadData);
    return { ok: false, error: uploadData.error || "Failed to get image URL from upload" };
  }

  console.log("Image URL after upload:", uploadData.secure_url);
  return { ok: true, url: uploadData.secure_url };
};

export const submitProfileUpdate = async (form: SettingsForm, imageUrl: string) => {
  console.log("Saving with image URL:", imageUrl);

  const res = await fetch("/api/user/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...form, image: imageUrl }),
  });

  const data = await res.json();
  console.log("Save response:", data);

  return { res, data };
};

export const deleteAccountRequest = async () => {
  const res = await fetch("/api/user/delete", {
    method: "DELETE",
  });
  const data = await res.json();
  return { res, data };
};

export const requestPasswordReset = async () => {
  const res = await fetch("/api/auth/request-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authenticatedOnly: true }),
  });
  const data = await res.json();
  return { res, data };
};
