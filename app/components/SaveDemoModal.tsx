"use client";
import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { X } from "lucide-react";
import Image from "next/image";

interface SaveDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    tags?: string[];
    integrations?: string[];
    userRoles?: string[];
    featured?: boolean;
  }) => void;
  initialTitle?: string;
  initialDescription?: string;
  processing?: boolean;
  isSaved?: boolean;
}

const FIELD_CLASS =
  "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] focus:border-[#7C5CFC] transition-all text-black";

const LABEL_CLASS = "block text-sm font-medium text-gray-700 mb-2";

// The comma-separated metadata fields (tags, integrations, roles) all parse the same way.
function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function LabeledTextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={FIELD_CLASS}
        disabled={disabled}
      />
    </div>
  );
}

// The comma-separated metadata, seeded from the demo being edited (or reset for a new one).
function useDemoMetadata(isOpen: boolean) {
  const [tags, setTags] = useState("");
  const [integrations, setIntegrations] = useState("");
  const [userRoles, setUserRoles] = useState("");
  const [featured, setFeatured] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const demoId = new URLSearchParams(window.location.search).get("demoId");
    if (!demoId) {
      setTags("");
      setIntegrations("");
      setUserRoles("");
      setFeatured(false);
      return;
    }
    fetch(`/api/demo?id=${demoId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.demo) {
          setTags((data.demo.tags || []).join(", "));
          setIntegrations((data.demo.integrations || []).join(", "));
          setUserRoles((data.demo.userRoles || []).join(", "));
          setFeatured(!!data.demo.featured);
        }
      })
      .catch((err) => console.error("Error loading demo metadata:", err));
  }, [isOpen]);

  return {
    tags,
    setTags,
    integrations,
    setIntegrations,
    userRoles,
    setUserRoles,
    featured,
    setFeatured,
  };
}

// Prevent body scroll while the modal is open.
function useLockBodyScroll(isOpen: boolean) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);
}

export default function SaveDemoModal({
  isOpen,
  onClose,
  onSave,
  initialTitle = "",
  initialDescription = "",
  processing = false,
  isSaved = false,
}: SaveDemoModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const {
    tags,
    setTags,
    integrations,
    setIntegrations,
    userRoles,
    setUserRoles,
    featured,
    setFeatured,
  } = useDemoMetadata(isOpen);

  // Update internal state when props change
  useEffect(() => {
    setTitle(initialTitle);
    setDescription(initialDescription);
  }, [initialTitle, initialDescription]);

  useLockBodyScroll(isOpen);

  const handleSave = () => {
    onSave({
      title,
      description,
      tags: splitCsv(tags),
      integrations: splitCsv(integrations),
      userRoles: splitCsv(userRoles),
      featured,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center">
      {/* Backdrop with blur effect */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Save Demo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <LabeledTextField
            label="Title *"
            value={title}
            onChange={setTitle}
            placeholder="Enter demo title..."
            disabled={processing}
          />

          {/* Description Input */}
          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter demo description..."
              rows={3}
              className={`${FIELD_CLASS} resize-none`}
              disabled={processing}
            />
          </div>

          <LabeledTextField
            label="Tags"
            value={tags}
            onChange={setTags}
            placeholder="e.g. analytics, pricing (comma-separated)"
            disabled={processing}
          />

          <LabeledTextField
            label="Target Integrations"
            value={integrations}
            onChange={setIntegrations}
            placeholder="e.g. Slack, HubSpot, Zoom (comma-separated)"
            disabled={processing}
          />

          <LabeledTextField
            label="Target User Roles"
            value={userRoles}
            onChange={setUserRoles}
            placeholder="e.g. Manager, Developer, Admin (comma-separated)"
            disabled={processing}
          />

          {/* Featured Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="featured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 rounded text-[#7C5CFC] border-gray-300 focus:ring-[#7C5CFC]"
              disabled={processing}
            />
            <label
              htmlFor="featured"
              className="text-sm font-medium text-gray-700 cursor-pointer select-none"
            >
              Mark as Featured Demo
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || processing || isSaved}
            className={`flex-1 flex items-center gap-2 text-white ${
              isSaved
                ? "bg-green-600 hover:bg-green-600 cursor-not-allowed"
                : "bg-[#7C5CFC] hover:bg-[#8A76FC]"
            }`}
          >
            <Image src="/icons/1.png" alt="Save" width={16} height={16} />
            {isSaved ? "✓ Saved" : processing ? "Saving..." : "Save Demo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
