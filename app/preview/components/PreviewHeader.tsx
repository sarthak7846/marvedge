"use client";
import { FaDownload } from "react-icons/fa";
import { ArrowLeft, Share2 } from "lucide-react";
import DownloadModal from "../../components/DownloadModal";

interface PreviewHeaderProps {
  onBack: () => void;
  onShare: () => void;
  downloadOpen: boolean;
  setDownloadOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onDownloadFile: (args: { title: string; format: "webm" | "mp4" }) => void;
  title: string;
  exportMenuOpen: boolean;
  setExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onDownload: () => void;
}

export default function PreviewHeader({
  onBack,
  onShare,
  downloadOpen,
  setDownloadOpen,
  onDownloadFile,
  title,
  exportMenuOpen,
  setExportMenuOpen,
  onDownload,
}: PreviewHeaderProps) {
  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Video Preview</h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onShare}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setDownloadOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FaDownload className="w-4 h-4" />
                <span>Download</span>
              </button>
              {/* Download Modal */}
              <DownloadModal
                isOpen={downloadOpen}
                onClose={() => setDownloadOpen(false)}
                onDownload={onDownloadFile}
                defaultTitle={title}
              />

              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-[#ede7fa] rounded-lg shadow z-10">
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-[#F6F3FF] text-[#7C5CFC] text-sm rounded-t-lg"
                    onClick={() => {
                      setExportMenuOpen(false);
                      onDownload(); // ✅ actually download
                    }}
                  >
                    Download WebM
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-[#F6F3FF] text-[#7C5CFC] text-sm rounded-t-lg"
                    onClick={() => {
                      setExportMenuOpen(false);
                      onDownload(); // ✅ actually download
                    }}
                  >
                    Download Mp4
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
