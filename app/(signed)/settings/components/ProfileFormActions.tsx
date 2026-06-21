type ProfileFormActionsProps = {
  isSaving: boolean;
  isUploading: boolean;
  onCancel: () => void;
};

export default function ProfileFormActions({
  isSaving,
  isUploading,
  onCancel,
}: ProfileFormActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 mt-8">
      <button
        type="button"
        className="px-8 py-3 cursor-pointer rounded-lg bg-white border border-gray-200 text-[#7C5CFC] font-semibold shadow hover:bg-[#ede7fa] transition w-full sm:w-auto"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSaving || isUploading}
        className="px-8 py-3 cursor-pointer rounded-lg bg-[#7C5CFC] text-white font-semibold shadow hover:bg-[#8A76FC] transition w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
