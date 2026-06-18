import { Menu } from "lucide-react";
import { toast } from "sonner";
import { useBlobStore } from "@/app/store/blobStore";
import RecorderSettingsDialog from "@/app/components/RecorderSettingsDialog";
import RecorderMainPanel from "@/app/components/RecorderMainPanel";

interface InitialRecorderViewProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  title: string;
  setTitle: (title: string) => void;
  uploadedFileUrl: string | null;
  setUploadedFileUrl: (url: string | null) => void;
  setUploadedFileType: (type: string | null) => void;
  setUploadMessage: (message: string) => void;
  uploadMessage: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  startScreenShare: () => void;
  toggleMic: () => void;
  micEnabled: boolean;
}

export default function InitialRecorderView({
  sidebarOpen,
  setSidebarOpen,
  title,
  setTitle,
  uploadedFileUrl,
  setUploadedFileUrl,
  setUploadedFileType,
  setUploadMessage,
  uploadMessage,
  fileInputRef,
  startScreenShare,
  toggleMic,
  micEnabled,
}: InitialRecorderViewProps) {
  const { setBlob } = useBlobStore();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setUploadedFileUrl(fileUrl);
      setUploadedFileType(file.type);
      setBlob(file);
      setUploadMessage("✅ Uploaded successfully!");
      toast.success("File uploaded successfully!");
      setTimeout(() => setUploadMessage(""), 3000);
    } else {
      toast.error("No file selected or upload failed.");
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex items-center sm:hidden mb-2">
        <button
          className="md:hidden fixed top-0 left-0 z-50 bg-[#7C5CFC] text-white p-3 shadow-lg focus:outline-none "
          onClick={() => setSidebarOpen(true)}
          aria-label="Open settings"
        >
          <Menu size={28} />
        </button>
      </div>

      <RecorderSettingsDialog
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        title={title}
        setTitle={setTitle}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        uploadMessage={uploadMessage}
        startScreenShare={startScreenShare}
      />

      <RecorderMainPanel
        uploadedFileUrl={uploadedFileUrl}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        startScreenShare={startScreenShare}
        toggleMic={toggleMic}
        micEnabled={micEnabled}
      />
    </div>
  );
}
