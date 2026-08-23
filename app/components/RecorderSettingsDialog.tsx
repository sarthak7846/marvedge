import Image from "next/image";
import { Dialog } from "@headlessui/react";
import { UPLOAD_VIDEO_ACCEPT } from "@/app/lib/subtitles";

interface RecorderSettingsDialogProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  title: string;
  setTitle: (title: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadMessage: string;
  startScreenShare: () => void;
}

export default function RecorderSettingsDialog({
  sidebarOpen,
  setSidebarOpen,
  title,
  setTitle,
  fileInputRef,
  handleFileUpload,
  uploadMessage,
  startScreenShare,
}: RecorderSettingsDialogProps) {
  return (
    <Dialog open={sidebarOpen} onClose={() => setSidebarOpen(false)} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-y-0 left-0 w-[90vw] max-w-xs bg-white shadow-2xl p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-[#7C5CFC]">Recorder Settings</h2>
          <button
            className="text-[#7C5CFC] text-2xl p-1 rounded hover:bg-[#ede7fa] focus:outline-none"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div>
          <label className="block text-[#7C5CFC] font-semibold mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-[#ede7fa] rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC] text-base"
            placeholder="Enter recording title"
          />
        </div>

        <div>
          <label className="block text-[#7C5CFC] font-semibold mb-1">Recording Source</label>
          <div className="border-2 border-dashed border-[#A594F9] rounded-lg p-4 flex flex-col items-center justify-center mb-4 bg-[#F8F6FF]">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 text-[#7C5CFC] font-semibold text-base focus:outline-none"
            >
              <span className="text-2xl">
                <Image
                  src="/icons/upload_icon.png"
                  alt="Notifications"
                  width={20}
                  height={20}
                  className="md:w-6 md:h-6"
                />
              </span>
              Upload Screen Recording
              <span className="text-xs text-gray-400">MP4, MOV up to 100MB</span>
            </button>
            <input
              type="file"
              accept={UPLOAD_VIDEO_ACCEPT}
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            {uploadMessage && <div className="mt-2 text-green-600 text-xs">{uploadMessage}</div>}
          </div>
          <button
            onClick={startScreenShare}
            className="w-full mt-2 px-4 py-3 rounded-lg bg-white text-[#7C5CFC] font-semibold shadow hover:bg-[#8A76FC] hover:text-white transition flex items-center justify-center gap-2 text-base"
          >
            <Image
              src="/icons/play_button_icon.png"
              alt="Notifications"
              width={20}
              height={20}
              className="md:w-6 md:h-6"
            />
            Start Screen Sharing
          </button>
        </div>
      </div>
    </Dialog>
  );
}
