"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

export interface DnsVerification {
  cnameTarget: string;
  txtRecordName?: string;
  txtRecordValue?: string;
  sslTxtName?: string;
  sslTxtValue?: string;
}

export interface HubSettingsData {
  logoUrl: string | null;
  brandColor: string;
  textColor: string;
  accentColor: string;
  hubTitle: string;
  hubDescription: string;
  subdomainPrefix: string;
  userId: string;
  customDomain: string | null;
  sslStatus: string;
  dnsVerification: DnsVerification | null;
}

const DEFAULT_FORM: HubSettingsData = {
  logoUrl: null,
  brandColor: "#7C5CFC",
  textColor: "#111827",
  accentColor: "#F3F0FC",
  hubTitle: "",
  hubDescription: "",
  subdomainPrefix: "",
  userId: "",
  customDomain: "",
  sslStatus: "pending",
  dnsVerification: null,
};

// Subdomains are stored as "<prefix>-<userIdFragment>"; only the prefix is editable.
function extractPrefix(fullSubdomain: string): string {
  const dashIdx = fullSubdomain.lastIndexOf("-");
  return dashIdx !== -1 ? fullSubdomain.substring(0, dashIdx) : "user";
}

async function uploadLogo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "upload_preset_1"); // standard preset configured

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error("Upload request failed");
  }

  const uploadResult = await res.json();
  if (!uploadResult.secure_url) {
    throw new Error("No URL returned");
  }
  return uploadResult.secure_url;
}

async function postHubSettings(form: HubSettingsData) {
  const res = await fetch("/api/hub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      logoUrl: form.logoUrl,
      brandColor: form.brandColor,
      textColor: form.textColor,
      accentColor: form.accentColor,
      hubTitle: form.hubTitle,
      hubDescription: form.hubDescription,
      subdomain: form.subdomainPrefix,
      customDomain: form.customDomain || null,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Save failed");
  }
  return data;
}

async function postDomainVerification() {
  const res = await fetch("/api/hub/verify", { method: "POST" });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Verification failed");
  }
  return data;
}

export function useHubSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<HubSettingsData>(DEFAULT_FORM);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/hub");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings) {
            const s = data.settings;
            setForm({
              logoUrl: s.logoUrl || null,
              brandColor: s.brandColor || DEFAULT_FORM.brandColor,
              textColor: s.textColor || DEFAULT_FORM.textColor,
              accentColor: s.accentColor || DEFAULT_FORM.accentColor,
              hubTitle: s.hubTitle || "",
              hubDescription: s.hubDescription || "",
              subdomainPrefix: extractPrefix(s.subdomain || ""),
              userId: s.userId || "",
              customDomain: s.customDomain || "",
              sslStatus: s.sslStatus || "pending",
              dnsVerification: s.dnsVerification || null,
            });
          }
        }
      } catch (err) {
        console.error("Error loading hub settings:", err);
        toast.error("Failed to load branding settings.");
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleColorChange = (name: string, val: string) => {
    setForm((prev) => ({ ...prev, [name]: val }));
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: null }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setLogoUploading(true);
    const uploadToast = toast.loading("Uploading logo...");

    try {
      const secureUrl = await uploadLogo(file);
      setForm((prev) => ({ ...prev, logoUrl: secureUrl }));
      toast.success("Logo uploaded successfully!", { id: uploadToast });
    } catch (err) {
      console.error("Logo upload error:", err);
      toast.error("Failed to upload logo. Please try again.", { id: uploadToast });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const saveToast = toast.loading("Saving hub settings...");

    try {
      const data = await postHubSettings(form);
      setForm((prev) => ({
        ...prev,
        subdomainPrefix: extractPrefix(data.settings.subdomain || ""),
        userId: data.settings.userId || prev.userId,
        sslStatus: data.settings.sslStatus || "pending",
        dnsVerification: data.settings.dnsVerification || null,
      }));
      toast.success("Hub branding settings saved!", { id: saveToast });
    } catch (err) {
      console.error("Save settings error:", err);
      toast.error((err as Error).message || "Failed to save settings.", { id: saveToast });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    const verifyToast = toast.loading("Verifying domain status with Cloudflare...");

    try {
      const data = await postDomainVerification();
      setForm((prev) => ({
        ...prev,
        sslStatus: data.sslStatus || prev.sslStatus || "pending",
        dnsVerification: data.dnsVerification || prev.dnsVerification,
      }));
      if (data.sslStatus === "active") {
        toast.success("Domain verified successfully! SSL is active.", { id: verifyToast });
      } else if (data.sslStatus) {
        toast.success("Records updated, but verification is still pending.", { id: verifyToast });
      } else {
        toast.error("Please click 'Save Configuration' first to register the domain.", {
          id: verifyToast,
        });
      }
    } catch (err) {
      console.error("Verification error:", err);
      toast.error((err as Error).message || "Failed to check domain status.", { id: verifyToast });
    } finally {
      setVerifying(false);
    }
  };

  return {
    loading,
    saving,
    verifying,
    logoUploading,
    fileInputRef,
    form,
    handleChange,
    handleColorChange,
    handleRemoveLogo,
    handleLogoUpload,
    handleSave,
    handleVerify,
  };
}
