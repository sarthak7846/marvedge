import type { UseSettingsReturn } from "../hooks/useSettings";
import AvatarSection from "./AvatarSection";
import PhotoUploadCard from "./PhotoUploadCard";
import ProfileFormFields from "./ProfileFormFields";
import ProfileFormActions from "./ProfileFormActions";

type ProfileTabProps = {
  settings: UseSettingsReturn;
};

export default function ProfileTab({ settings }: ProfileTabProps) {
  return (
    <div className="px-2 sm:px-4 md:px-8 lg:px-16 xl:px-24">
      <div className="w-full mx-auto mt-8 mb-2">
        <h2 className="text-2xl font-bold mb-1">Profile Information</h2>
        <p className="text-gray-500 mb-6">Manage your profile settings here.</p>
      </div>
      <form
        className="card w-full mx-auto mt-2 mb-12 bg-white rounded-xl border border-[#ede7fa] shadow-none p-4 sm:p-6 md:p-8 lg:p-10 relative"
        onSubmit={settings.handleSave}
        noValidate
      >
        <AvatarSection
          avatar={settings.avatar}
          initials={settings.initials}
          isSaving={settings.isSaving}
          isUploading={settings.isUploading}
          fileInputRef={settings.fileInputRef}
          onChangePhoto={() => settings.setShowPhotoCard(true)}
          onRemovePhoto={settings.handleRemovePhoto}
          onPhotoChange={settings.handlePhotoChange}
        />

        {settings.showPhotoCard && (
          <PhotoUploadCard
            isDragging={settings.isDragging}
            fileInputRef={settings.fileInputRef}
            onClose={() => settings.setShowPhotoCard(false)}
            onDragOver={settings.handleDragOver}
            onDragLeave={settings.handleDragLeave}
            onDrop={settings.handleDrop}
          />
        )}

        <ProfileFormFields form={settings.form} onChange={settings.handleInputChange} />

        {settings.isDirty && settings.hasChanges && (
          <ProfileFormActions
            isSaving={settings.isSaving}
            isUploading={settings.isUploading}
            onCancel={settings.handleCancel}
          />
        )}
      </form>
    </div>
  );
}
