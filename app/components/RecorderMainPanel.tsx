import CameraBubblePreview from "@/app/components/CameraBubblePreview";

interface RecorderMainPanelProps {
  uploadedFileUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  startScreenShare: () => void;
  toggleMic: () => void;
  micEnabled: boolean;
  /** WTM-6.4: false hides the camera controls entirely (feature flag off). */
  cameraAvailable: boolean;
  toggleCamera: () => void;
  cameraEnabled: boolean;
  cameraStarting: boolean;
}

export default function RecorderMainPanel({
  uploadedFileUrl,
  fileInputRef,
  handleFileUpload,
  startScreenShare,
  toggleMic,
  micEnabled,
  cameraAvailable,
  toggleCamera,
  cameraEnabled,
  cameraStarting,
}: RecorderMainPanelProps) {
  return (
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
          {cameraAvailable && cameraEnabled && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <CameraBubblePreview className="h-24 w-24 sm:h-28 sm:w-28" />
              <span className="text-xs text-gray-400">
                This bubble is recorded alongside your screen
              </span>
            </div>
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
            {cameraAvailable && (
              <div className="camera flex items-center gap-2 sm:gap-3 ml-0 sm:ml-4 mt-2 sm:mt-0 w-full sm:w-auto justify-center">
                <span className="text-[#888] font-medium text-sm sm:text-base">Camera</span>
                <button
                  onClick={toggleCamera}
                  disabled={cameraStarting}
                  aria-pressed={cameraEnabled}
                  aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
                  className={`toggle w-10 sm:w-12 h-6 rounded-full flex items-center px-1 transition ${cameraEnabled ? "bg-[#6C63FF]" : "bg-gray-300"} cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <span
                    className={`toggle-circle w-4 h-4 bg-white rounded-full shadow transition-transform ${cameraEnabled ? "translate-x-4 sm:translate-x-6" : ""}`}
                  />
                </button>
              </div>
            )}
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
  );
}
