"use client";

interface NoVideoFoundProps {
  onGoHome: () => void;
}

export default function NoVideoFound({ onGoHome }: NoVideoFoundProps) {
  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">No Video Found</h1>
        <button
          onClick={onGoHome}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
