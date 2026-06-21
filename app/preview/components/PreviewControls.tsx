"use client";
import React from "react";
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand } from "react-icons/fa";
import { formatTime } from "../utils/previewHelpers";

interface PreviewControlsProps {
  playing: boolean;
  onPlayPause: () => void;
  duration: number;
  currentTime: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  muted: boolean;
  volume: number;
  onMuteToggle: () => void;
  onVolumeChange: (newVolume: number) => void;
  onFullscreen: () => void;
}

export default function PreviewControls({
  playing,
  onPlayPause,
  duration,
  currentTime,
  onSeek,
  muted,
  volume,
  onMuteToggle,
  onVolumeChange,
  onFullscreen,
}: PreviewControlsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-6">
      <div className="flex items-center space-x-4">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          className="flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
        >
          {playing ? (
            <FaPause className="w-5 h-5 text-white" />
          ) : (
            <FaPlay className="w-5 h-5 text-white ml-1" />
          )}
        </button>

        {/* Progress Bar */}
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration}
            value={currentTime}
            onChange={onSeek}
            className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #7C5CFC 0%, #7C5CFC ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) 100%)`,
            }}
          />
        </div>

        {/* Time Display */}
        <div className="text-white text-sm font-mono min-w-[100px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Volume Control */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onMuteToggle}
            className="text-white hover:text-gray-300 transition-colors"
          >
            {muted || volume === 0 ? (
              <FaVolumeMute className="w-5 h-5" />
            ) : (
              <FaVolumeUp className="w-5 h-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-2 bg-white/30 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Fullscreen Button */}
        <button onClick={onFullscreen} className="text-white hover:text-gray-300 transition-colors">
          <FaExpand className="w-5 h-5" />
        </button>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #7c5cfc;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #7c5cfc;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
