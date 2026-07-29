"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { HUB_CNAME_TARGET, HUB_ROOT_DOMAIN } from "@/app/lib/hubDomain";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const POLL_INTERVAL_MS = 30_000;
const MAX_BACKGROUND_POLLS = 20;

interface HubSettingsData {
  logoUrl: string | null;
  brandColor: string;
  textColor: string;
  accentColor: string;
  hubTitle: string;
  hubDescription: string;
  subdomain: string;
  userId: string;
  customDomain: string | null;
  sslStatus: string;
  dnsVerification: {
    cnameTarget: string;
    txtRecordName?: string;
    txtRecordValue?: string;
    sslTxtName?: string;
    sslTxtValue?: string;
  } | null;
}

export default function BrandingTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [customDomainAllowed, setCustomDomainAllowed] = useState(false);
  const [demoCounts, setDemoCounts] = useState({ total: 0, public: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<HubSettingsData>({
    logoUrl: null,
    brandColor: "#7C5CFC",
    textColor: "#111827",
    accentColor: "#F3F0FC",
    hubTitle: "",
    hubDescription: "",
    subdomain: "",
    userId: "",
    customDomain: "",
    sslStatus: "pending",
    dnsVerification: null,
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/hub");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings) {
            setCustomDomainAllowed(!!data.customDomainAllowed);
            setDemoCounts({ total: data.demoCount || 0, public: data.publicDemoCount || 0 });
            setForm({
              logoUrl: data.settings.logoUrl || null,
              brandColor: data.settings.brandColor || "#7C5CFC",
              textColor: data.settings.textColor || "#111827",
              accentColor: data.settings.accentColor || "#F3F0FC",
              hubTitle: data.settings.hubTitle || "",
              hubDescription: data.settings.hubDescription || "",
              subdomain: data.settings.subdomain || "",
              userId: data.settings.userId || "",
              customDomain: data.settings.customDomain || "",
              sslStatus: data.settings.sslStatus || "pending",
              dnsVerification: data.settings.dnsVerification || null,
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Enforce the limits the copy below promises, before spending an upload.
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file (PNG, JPG or WEBP).");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo is too large. Maximum size is 2MB.");
      e.target.value = "";
      return;
    }

    setLogoUploading(true);
    const uploadToast = toast.loading("Uploading logo...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload request failed");
      }

      const uploadResult = await res.json();
      if (uploadResult.secure_url) {
        setForm((prev) => ({ ...prev, logoUrl: uploadResult.secure_url }));
        toast.success("Logo uploaded successfully!", { id: uploadToast });
      } else {
        throw new Error("No URL returned");
      }
    } catch (err) {
      console.error("Logo upload error:", err);
      toast.error("Failed to upload logo. Please try again.", { id: uploadToast });
    } finally {
      setLogoUploading(false);
      // Allow re-selecting the same file after a failure.
      e.target.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const saveToast = toast.loading("Saving hub settings...");

    try {
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
          subdomain: form.subdomain,
          customDomain: form.customDomain || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const savedSubdomain = data.settings.subdomain || "";
        setForm((prev) => ({
          ...prev,
          subdomain: savedSubdomain,
          userId: data.settings.userId || prev.userId,
          customDomain: data.settings.customDomain || "",
          sslStatus: data.settings.sslStatus || "pending",
          dnsVerification: data.settings.dnsVerification || null,
        }));
        // The server may hand back a disambiguated name if the one requested was
        // taken — say so rather than letting the field silently change.
        if (savedSubdomain && savedSubdomain !== form.subdomain) {
          toast.success(`Saved. Your hub is at ${savedSubdomain}.${HUB_ROOT_DOMAIN}`, {
            id: saveToast,
          });
        } else {
          toast.success("Hub branding settings saved!", { id: saveToast });
        }
      } else {
        throw new Error(data.error || "Save failed");
      }
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
      const res = await fetch("/api/hub/verify", {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok && data.success) {
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
      } else {
        throw new Error(data.error || "Verification failed");
      }
    } catch (err) {
      console.error("Verification error:", err);
      toast.error((err as Error).message || "Failed to check domain status.", { id: verifyToast });
    } finally {
      setVerifying(false);
    }
  };

  // While a certificate is still being issued, refresh quietly in the background
  // so the card flips to "active" on its own. The cron job (see
  // app/api/cron/hub-domains) does the same server-side for users who navigated
  // away; this only makes the open page feel live.
  useEffect(() => {
    if (loading || !form.customDomain || form.sslStatus === "active") {
      return;
    }

    let cancelled = false;
    // Certificate issuance takes minutes, not hours. Stop after ~10 minutes so a
    // forgotten open tab cannot poll Cloudflare indefinitely — the cron keeps
    // working regardless, and the manual button is always there.
    let remaining = MAX_BACKGROUND_POLLS;

    const timer = setInterval(async () => {
      if (remaining-- <= 0) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await fetch("/api/hub/verify", { method: "POST" });
        const data = await res.json();
        if (cancelled || !res.ok || !data.success) {
          return;
        }
        setForm((prev) => ({
          ...prev,
          sslStatus: data.sslStatus || prev.sslStatus,
          dnsVerification: data.dnsVerification || prev.dnsVerification,
        }));
      } catch {
        // Background refresh — stay silent and try again on the next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loading, form.customDomain, form.sslStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-[#7C5CFC] text-xl animate-pulse font-medium">
          Loading hub settings...
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 md:px-8 lg:px-16 xl:px-24 max-w-7xl mx-auto mt-8 mb-12">
      <div className="w-full mb-6">
        <h2 className="text-2xl font-bold mb-1 text-gray-800">Demo Hub & Branding</h2>
        <p className="text-gray-500">
          Configure your customizable product showcase portal and white-label custom domain
          settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          <div className="card bg-white rounded-xl border border-[#ede7fa] dark:border-[rgba(255,255,255,0.08)] p-6 md:p-8 space-y-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-white border-b dark:border-b-[rgba(255,255,255,0.08)] pb-2">
              Branding Visuals
            </h3>

            {/* Logo Section */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-lg bg-gray-50 dark:bg-[#151229] border border-dashed border-gray-300 dark:border-[rgba(255,255,255,0.15)] flex items-center justify-center overflow-hidden shrink-0 relative">
                {form.logoUrl ? (
                  <Image src={form.logoUrl} alt="Logo" fill className="object-contain p-2" />
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 text-xs text-center px-2">
                    No logo uploaded
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Hub Custom Logo
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Supported formats: PNG, JPG, WEBP. Max size 2MB.
                </span>
                <div className="flex gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="px-4 py-2 bg-[#7C5CFC] hover:bg-[#6c4be0] text-white text-xs font-semibold rounded-md transition-colors"
                  >
                    {logoUploading ? "Uploading..." : "Upload logo"}
                  </button>
                  {form.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logoUrl: null }))}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#151229] dark:hover:bg-[#1b1735] text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-md border dark:border-[rgba(255,255,255,0.08)] transition-colors"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Brand Color
                </label>
                <div className="flex items-center gap-2 border dark:border-[rgba(255,255,255,0.08)] rounded-md p-2 bg-gray-50 dark:bg-[#151229]">
                  <input
                    type="color"
                    value={form.brandColor}
                    onChange={(e) => handleColorChange("brandColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-[rgba(255,255,255,0.15)]"
                  />
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {form.brandColor}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Text Color
                </label>
                <div className="flex items-center gap-2 border dark:border-[rgba(255,255,255,0.08)] rounded-md p-2 bg-gray-50 dark:bg-[#151229]">
                  <input
                    type="color"
                    value={form.textColor}
                    onChange={(e) => handleColorChange("textColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-[rgba(255,255,255,0.15)]"
                  />
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {form.textColor}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Accent Background
                </label>
                <div className="flex items-center gap-2 border dark:border-[rgba(255,255,255,0.08)] rounded-md p-2 bg-gray-50 dark:bg-[#151229]">
                  <input
                    type="color"
                    value={form.accentColor}
                    onChange={(e) => handleColorChange("accentColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-[rgba(255,255,255,0.15)]"
                  />
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {form.accentColor}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-xl border border-[#ede7fa] dark:border-[rgba(255,255,255,0.08)] p-6 md:p-8 space-y-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-white border-b dark:border-b-[rgba(255,255,255,0.08)] pb-2">
              Hub Content
            </h3>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="hubTitle" className="text-sm font-semibold text-gray-600">
                  Hub Name / Title
                </label>
                <input
                  type="text"
                  id="hubTitle"
                  name="hubTitle"
                  value={form.hubTitle}
                  onChange={handleChange}
                  placeholder="e.g. Acme Product Hub"
                  className="border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] w-full"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="hubDescription" className="text-sm font-semibold text-gray-600">
                  Hub Description
                </label>
                <textarea
                  id="hubDescription"
                  name="hubDescription"
                  value={form.hubDescription}
                  onChange={handleChange}
                  placeholder="Introduce prospects and clients to your demo tours library..."
                  rows={3}
                  className="border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] w-full resize-none"
                />
              </div>
            </div>
          </div>

          <div className="card bg-white rounded-xl border border-[#ede7fa] dark:border-[rgba(255,255,255,0.08)] p-6 md:p-8 space-y-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-white border-b dark:border-b-[rgba(255,255,255,0.08)] pb-2">
              Hosting & Subdomains
            </h3>

            <div className="grid grid-cols-1 gap-6">
              {/* Subdomain */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="subdomain" className="text-sm font-semibold text-gray-600">
                  Marvedge Subdomain
                </label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-[rgba(255,255,255,0.08)] focus-within:ring-2 focus-within:ring-[#7C5CFC]">
                  <input
                    type="text"
                    id="subdomain"
                    name="subdomain"
                    value={form.subdomain}
                    onChange={handleChange}
                    className="p-2.5 text-sm focus:outline-none w-full text-right font-medium"
                    placeholder="my-company"
                  />
                  <span className="bg-gray-100 dark:bg-[#151229] px-3 flex items-center border-l dark:border-l-[rgba(255,255,255,0.08)] text-sm text-gray-500 font-medium whitespace-nowrap">
                    .{HUB_ROOT_DOMAIN}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Serve your demo hub instantly at this address. If the name is already taken we
                  will add a short unique suffix.
                </p>
                {form.subdomain && (
                  <a
                    href={`https://${form.subdomain}.${HUB_ROOT_DOMAIN}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[#7C5CFC] hover:underline w-fit"
                  >
                    Open my hub ↗
                  </a>
                )}
              </div>

              {/* Custom Domain */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="customDomain" className="text-sm font-semibold text-gray-600">
                  Custom Domain (CNAME / White-Label)
                  {!customDomainAllowed && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-[#F3F0FC] text-[#7C5CFC] text-[10px] font-bold uppercase tracking-wider align-middle">
                      Pro
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  id="customDomain"
                  name="customDomain"
                  value={form.customDomain || ""}
                  onChange={handleChange}
                  disabled={!customDomainAllowed}
                  placeholder="e.g. demos.mycompany.com"
                  className={`border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] w-full font-medium ${
                    customDomainAllowed ? "" : "bg-gray-50 text-gray-400 cursor-not-allowed"
                  }`}
                />
                <p className="text-xs text-gray-400">
                  {customDomainAllowed
                    ? "Map your own custom domain by pointing its CNAME record to Marvedge."
                    : "Serving your hub on your own domain is available on PRO and ENTERPRISE plans. Your Marvedge subdomain above works on every plan."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`px-8 py-3 bg-[#7C5CFC] hover:bg-[#6c4be0] text-white font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                saving ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {saving ? "Saving settings..." : "Save Configuration"}
            </button>
          </div>
        </form>

        {/* Verification Status Card */}
        <div className="space-y-6">
          {/* Hub contents. A demo is only published to the hub once it has a
              public share link, which is invisible from the editor otherwise. */}
          <div className="card bg-white rounded-xl border border-[#ede7fa] dark:border-[rgba(255,255,255,0.08)] p-6 space-y-2">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-white border-b dark:border-b-[rgba(255,255,255,0.08)] pb-2">
              Demos in your hub
            </h3>
            <p className="text-3xl font-bold text-[#7C5CFC]">
              {demoCounts.public}
              <span className="text-base font-medium text-gray-400"> of {demoCounts.total}</span>
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              {demoCounts.public === 0
                ? "Your hub is empty. Demos appear here once you share them publicly from the demo list."
                : "Only demos you have shared publicly appear in your hub. Share a demo to add it."}
            </p>
          </div>

          <div className="card bg-white rounded-xl border border-[#ede7fa] dark:border-[rgba(255,255,255,0.08)] p-6 space-y-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-white border-b dark:border-b-[rgba(255,255,255,0.08)] pb-2">
              Verification Status
            </h3>

            {form.customDomain ? (
              <div className="space-y-6">
                {/* SSL Domain Status Badge */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-[#151229] border dark:border-[rgba(255,255,255,0.08)]">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Domain Configuration
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 break-all">
                      {form.customDomain}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase border shrink-0 ${
                      form.sslStatus === "active"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                    }`}
                  >
                    {form.sslStatus}
                  </span>
                </div>

                {form.sslStatus === "active" ? (
                  <div className="border border-green-200 dark:border-green-900/40 bg-green-50/55 dark:bg-green-950/20 rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold text-green-800 dark:text-green-400 flex items-center gap-1">
                      ✅ Domain Active & Secure
                    </h4>
                    <p className="text-xs text-green-700 dark:text-green-500 leading-relaxed">
                      Your custom domain is fully configured, verified, and secured with SSL. Your
                      public showcase is active at this address.
                    </p>
                  </div>
                ) : (
                  /* Stuck DNS Validations / instructions */
                  <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                    <div className="border border-amber-200 dark:border-amber-900/40 bg-amber-50/55 dark:bg-amber-950/20 rounded-lg p-4 space-y-2">
                      <h4 className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                        ⚠️ DNS Setup Required
                      </h4>
                      <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
                        To point your custom domain securely, configure the following DNS records on
                        your domain registrar (e.g. GoDaddy, Cloudflare, Namecheap).
                      </p>
                    </div>

                    {/* CNAME Instruction */}
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                        1. CNAME Record
                      </span>
                      <div className="bg-gray-50 dark:bg-[#151229] p-2.5 rounded border dark:border-[rgba(255,255,255,0.08)] text-xs font-mono select-all flex flex-col gap-1 text-gray-800 dark:text-gray-200">
                        <div>
                          <span className="text-gray-400 dark:text-gray-500">Type:</span> CNAME
                        </div>
                        <div>
                          <span className="text-gray-400 dark:text-gray-500">Host:</span> @ or
                          subdomain (e.g. demos)
                        </div>
                        <div>
                          <span className="text-gray-400 dark:text-gray-500">Points to:</span>{" "}
                          {form.dnsVerification?.cnameTarget || HUB_CNAME_TARGET}
                        </div>
                      </div>
                    </div>

                    {/* Ownership verification record */}
                    {form.dnsVerification?.txtRecordValue && (
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                          2. Ownership TXT Record
                        </span>
                        <div className="bg-gray-50 dark:bg-[#151229] p-2.5 rounded border dark:border-[rgba(255,255,255,0.08)] text-xs font-mono select-all flex flex-col gap-1 text-gray-800 dark:text-gray-200">
                          <div>
                            <span className="text-gray-400 dark:text-gray-500">Type:</span> TXT
                          </div>
                          <div className="break-all">
                            <span className="text-gray-400 dark:text-gray-500">Host:</span>{" "}
                            {form.dnsVerification.txtRecordName}
                          </div>
                          <div className="break-all">
                            <span className="text-gray-400 dark:text-gray-500">Value:</span>{" "}
                            {form.dnsVerification.txtRecordValue}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SSL Verification TXT record */}
                    {form.dnsVerification?.sslTxtValue && (
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                          3. SSL Validation TXT Record
                        </span>
                        <div className="bg-gray-50 dark:bg-[#151229] p-2.5 rounded border dark:border-[rgba(255,255,255,0.08)] text-xs font-mono select-all flex flex-col gap-1 text-gray-800 dark:text-gray-200">
                          <div>
                            <span className="text-gray-400 dark:text-gray-500">Type:</span> TXT
                          </div>
                          <div className="break-all">
                            <span className="text-gray-400 dark:text-gray-500">Host:</span>{" "}
                            {form.dnsVerification.sslTxtName}
                          </div>
                          <div className="break-all">
                            <span className="text-gray-400 dark:text-gray-500">Value:</span>{" "}
                            {form.dnsVerification.sslTxtValue}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className={`w-full py-2.5 bg-gray-100 dark:bg-[#151229] hover:bg-gray-200 dark:hover:bg-[#1d193d] text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.08)] transition-colors uppercase tracking-wider ${
                    verifying ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                >
                  {verifying ? "Refreshing status..." : "Refresh / Verify Status"}
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                Configure a custom domain name to generate DNS verification instructions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
