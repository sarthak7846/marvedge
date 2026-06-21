import Image from "next/image";
import { ChangeEvent, RefObject } from "react";

type AvatarSectionProps = {
  avatar: string;
  initials: string;
  isSaving: boolean;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onChangePhoto: () => void;
  onRemovePhoto: () => void;
  onPhotoChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

export default function AvatarSection({
  avatar,
  initials,
  isSaving,
  isUploading,
  fileInputRef,
  onChangePhoto,
  onRemovePhoto,
  onPhotoChange,
}: AvatarSectionProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-8">
      <div className="w-24 h-24">
        <div className="avatar-placeholder w-24 h-24 rounded-full bg-[#F3F0FC] flex items-center justify-center text-3xl font-bold text-[#7C5CFC] border-2 border-[#E0D7FF] cursor-pointer hover:opacity-80 transition-opacity">
          {avatar && avatar.trim() ? (
            <Image
              key={avatar}
              src={avatar}
              alt="Avatar"
              width={96}
              height={96}
              className="w-full h-full object-cover rounded-full"
              unoptimized
            />
          ) : (
            initials
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
        <button
          type="button"
          disabled={isSaving || isUploading}
          className="px-5 py-2 rounded-lg bg-[#7C5CFC] text-white font-semibold shadow hover:bg-[#8A76FC] transition w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onChangePhoto}
        >
          Change Photo
        </button>
        {avatar && avatar.trim() && (
          <button
            type="button"
            disabled={isSaving || isUploading}
            className="remove-photo-btn px-5 py-2 rounded-lg bg-white border border-gray-200 text-[#8A76FC] font-semibold shadow hover:bg-[#F3F0FC] transition w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={onRemovePhoto}
          >
            <Image src="/icons/si_bin-line.png" alt="Remove" width={18} height={18} />
            Remove Photo
          </button>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={onPhotoChange}
        />
      </div>
    </div>
  );
}
