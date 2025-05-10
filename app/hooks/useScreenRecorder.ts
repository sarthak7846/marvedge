import { useRef, useState } from "react";

export const useScreenRecorder = () => {
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true,
    });
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream);
    mediaRecorder.current = recorder;

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      console.log("Data avbl", e.data);
      chunks.push(e.data);
    };

    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(finalBlob);
      setVideoUrl(url);
    };

    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop()); // ✅ closes screen share
    setRecording(false);
  };

  return { startRecording, stopRecording, recording, videoUrl };
};
