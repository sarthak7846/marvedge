import ReactPlayer from "react-player";
import Image from "next/image";
import { FaVolumeMute, FaVolumeUp } from "react-icons/fa";

interface VideoUtilityControlsProps {
  playerRef: React.RefObject<ReactPlayer>;
  effectiveCurrentTime: number;
  effectiveDuration: number;
  speed: number;
  setCurrentTime: (t: number) => void;
  volume: number;
  setVolume: (t: number) => void;
  handleFullscreen: () => void;
}

export default function VideoUtilityControls({
  playerRef,
  effectiveCurrentTime,
  effectiveDuration,
  speed,
  setCurrentTime,
  volume,
  setVolume,
  handleFullscreen,
}: VideoUtilityControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => {
          const newEffective = Math.max(0, effectiveCurrentTime - 5);
          const newSource = newEffective * speed;
          setCurrentTime(newSource);
          playerRef.current?.seekTo(newSource, "seconds");
        }}
        className="p-2 rounded-full cursor-pointer bg-[#7C5CFC] hover:bg-[#6A4DE8] text-white transition playback-utility-icon"
        title="Back 5 seconds"
      >
        <Image src="/icons/replay.svg" alt="Replay" width={16} height={16} />
      </button>

      <button
        onClick={() => {
          const newEffective = Math.min(effectiveDuration, effectiveCurrentTime + 5);
          const newSource = newEffective * speed;
          setCurrentTime(newSource);
          playerRef.current?.seekTo(newSource, "seconds");
        }}
        className="p-2 rounded-full cursor-pointer bg-[#7C5CFC] hover:bg-[#6A4DE8] text-white transition playback-utility-icon"
        title="Forward 5 seconds"
      >
        <Image src="/icons/forward.svg" alt="Forward" width={16} height={16} />
      </button>

      <div className="flex items-center gap-2 w-36">
        <button
          onClick={() => setVolume(volume === 0 ? 1 : 0)}
          className="playback-utility-icon cursor-pointer"
        >
          {volume === 0 ? (
            <FaVolumeMute className="text-[#7C5CFC] text-xl" />
          ) : (
            <FaVolumeUp className="text-[#7C5CFC] text-xl" />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full h-2 rounded-lg accent-[#7C5CFC] playback-progress-bar-rail"
        />
      </div>

      <button
        onClick={handleFullscreen}
        className="p-2 rounded-full cursor-pointer bg-[#7C5CFC] hover:bg-[#6A4DE8] text-white transition playback-utility-icon"
        title="Fullscreen"
        type="button"
      >
        <Image src="/icons/Group 316.svg" alt="Fullscreen" width={16} height={16} />
      </button>
    </div>
  );
}
