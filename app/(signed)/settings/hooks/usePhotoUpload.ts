import React, { useRef, useState, ChangeEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import type { SettingsForm } from "../utils/settingsHelpers";

type UsePhotoUploadArgs = {
  setForm: Dispatch<SetStateAction<SettingsForm>>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
};

export function usePhotoUpload({ setForm, setIsDirty }: UsePhotoUploadArgs) {
  const [avatar, setAvatar] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showPhotoCard, setShowPhotoCard] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const applyImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setPhotoFile(file);
    setIsDirty(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatar(event.target.result as string);
        setForm((prev) => ({
          ...prev,
          image: event.target?.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      applyImageFile(e.target.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    console.log("Remove photo clicked");
    setPhotoFile(null);
    setAvatar("");
    setForm((prev) => ({ ...prev, image: "" }));
    setIsDirty(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setShowPhotoCard(false);
      applyImageFile(files[0]);
    }
  };

  return {
    avatar,
    setAvatar,
    fileInputRef,
    photoFile,
    setPhotoFile,
    showPhotoCard,
    setShowPhotoCard,
    isDragging,
    isUploading,
    setIsUploading,
    handlePhotoChange,
    handleRemovePhoto,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
