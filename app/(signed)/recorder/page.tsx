"use client";

import { useScreenRecorder } from "@/app/hooks/useScreenRecorder";

const RecorderPage = () => {
  const { startRecording, stopRecording, recording, videoUrl } =
    useScreenRecorder();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Screen Recorder</h1>
      {!recording ? (
        <button onClick={startRecording} className="btn">
          Start Recording
        </button>
      ) : (
        <button onClick={stopRecording} className="btn">
          Stop Recording
        </button>
      )}

      {videoUrl && (
        <div className="mt-4">
          <h2 className="text-lg">Preview:</h2>
          <video src={videoUrl} controls className="mt-2" width={600} />
          <a href={videoUrl} download="recording.webm">
            <button>Download Recording</button>
          </a>
        </div>
      )}
    </div>
  );
};

export default RecorderPage;
