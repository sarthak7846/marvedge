import Image from "next/image";
import { Dialog } from "@headlessui/react";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { useBlobStore } from "@/app/store/blobStore";

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
                accept="video/mp4,video/webm,video/*"
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

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="header w-full flex flex-col sm:flex-row items-start sm:items-center justify-between px- sm:px-12 py-4 sm:py-6 bg-[#f3f0fc] border-b border-[#ede7fa]">
          <div>
            <div className="text-lg sm:text-2xl font-semibold text-[#1A0033]">New Recording</div>
            <p className="text-xs sm:text-sm text-gray-400">Last saved 2 minutes ago</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden px-0 sm:px-2 pb-0 sm:pb-2">
          <div className="record-card w-full max-w-360 mx-auto flex flex-col items-center justify-center bg-white rounded-2xl shadow-lg p-4 sm:p-8 flex-1 overflow-y-auto">
            {uploadedFileUrl ? (
              <video
                src={uploadedFileUrl}
                controls
                className="w-full h-[200px] sm:h-[400px] object-contain bg-[#F6F4FF] mb-4 sm:mb-6 rounded-xl border border-[#7C5CFC]"
                style={{ maxWidth: 900 }}
              />
            ) : (
              <>
                <span
                  className="mb-10 mt-0"
                  style={{ width: 96, height: 66, display: "inline-block" }}
                >
                  <svg
                    className="video-icon w-full h-full"
                    viewBox="0 0 118 118"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M73.75 49.1667L96.1356 37.9763C96.885 37.6019 97.7176 37.4251 98.5546 37.4628C99.3915 37.5005 100.205 37.7514 100.918 38.1917C101.63 38.632 102.219 39.2472 102.627 39.9788C103.035 40.7103 103.25 41.5341 103.25 42.3718V75.6282C103.25 76.4659 103.035 77.2897 102.627 78.0212C102.219 78.7528 101.63 79.368 100.918 79.8083C100.205 80.2486 99.3915 80.4995 98.5546 80.5372C97.7176 80.5749 96.885 80.3981 96.1356 80.0237L73.75 68.8333V49.1667ZM14.75 39.3333C14.75 36.7254 15.786 34.2242 17.6301 32.3801C19.4742 30.536 21.9754 29.5 24.5833 29.5H63.9167C66.5246 29.5 69.0258 30.536 70.8699 32.3801C72.714 34.2242 73.75 36.7254 73.75 39.3333V78.6667C73.75 81.2746 72.714 83.7758 70.8699 85.6199C69.0258 87.464 66.5246 88.5 63.9167 88.5H24.5833C21.9754 88.5 19.4742 87.464 17.6301 85.6199C15.786 83.7758 14.75 81.2746 14.75 78.6667V39.3333Z"
                      stroke="currentColor"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="record-content flex flex-col items-center">
                  <div className="text-lg sm:text-xl font-semibold text-[#1A0033] mb-2 dark:text-white">
                    Start Sharing Your Screen
                  </div>
                  <p className="text-gray-400 text-center max-w-md mb-4 sm:mb-6 text-sm sm:text-base">
                    Click the below button or upload a screen share to begin.
                    <br />
                    creating your interactive demo
                  </p>
                </div>
              </>
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 sm:mt-6 justify-center items-center w-full">
              <button
                onClick={startScreenShare}
                className="share-btn w-full sm:w-auto px-4 sm:px-8 py-2 sm:py-3 rounded-lg bg-[#7C5CFC] text-white font-semibold shadow hover:bg-[#8A76FC] transition text-sm sm:text-base cursor-pointer"
              >
                Start Screen Share
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="upload-btn w-full sm:w-auto px-4 sm:px-8 py-2 sm:py-3 rounded-lg bg-white border border-[#ede7fa] text-[#7C5CFC] font-semibold shadow hover:bg-[#F3F0FC] transition text-sm sm:text-base cursor-pointer"
              >
                Upload File
              </button>
              <div className="mic flex items-center gap-2 sm:gap-3 ml-0 sm:ml-4 mt-2 sm:mt-0 w-full sm:w-auto justify-center">
                <span className="text-[#888] font-medium text-sm sm:text-base">Microphone</span>
                <button
                  onClick={toggleMic}
                  className={`toggle w-10 sm:w-12 h-6 rounded-full flex items-center px-1 transition ${micEnabled ? "bg-[#6C63FF]" : "bg-gray-300"} cursor-pointer`}
                >
                  <span
                    className={`toggle-circle w-4 h-4 bg-white rounded-full shadow transition-transform ${micEnabled ? "translate-x-4 sm:translate-x-6" : ""}`}
                  />
                </button>
              </div>
            </div>

            <input
              type="file"
              accept="video/mp4,video/webm,video/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
