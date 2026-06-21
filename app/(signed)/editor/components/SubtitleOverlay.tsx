interface SubtitleOverlayProps {
  text: string;
}

export default function SubtitleOverlay({ text }: SubtitleOverlayProps) {
  if (!text) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 bottom-6 z-40 flex justify-center px-6 pointer-events-none">
      <div
        className="max-w-[92%] rounded-md bg-black/70 px-3 py-2 text-center text-white"
        style={{
          fontSize: "16px",
          lineHeight: "1.25",
          textShadow: "0 1px 2px rgba(0,0,0,0.65)",
        }}
      >
        {text}
      </div>
    </div>
  );
}
