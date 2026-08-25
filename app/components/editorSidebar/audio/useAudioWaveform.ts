"use client";

import { useEffect, useState } from "react";

export interface WaveformPeaks {
  peaks: number[];
  durationSec: number;
}

const BARS = 60;

function webkitAudioContext(): typeof AudioContext {
  if (typeof window === "undefined") {
    return AudioContext;
  }
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext || w.webkitAudioContext || AudioContext;
}

/**
 * Decode an audio URL into normalized peak bars for the clip waveform. Uses the
 * Web Audio API (`decodeAudioData`) — no extra dependency.
 */
export function useAudioWaveform(url: string | null | undefined): WaveformPeaks | null {
  const [result, setResult] = useState<WaveformPeaks | null>(null);

  useEffect(() => {
    if (!url) {
      setResult(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch audio (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const Ctx = webkitAudioContext();
        const audioCtx = new Ctx();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) {
          return;
        }

        const channel = decoded.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(channel.length / BARS));
        const peaks: number[] = [];
        for (let i = 0; i < BARS; i++) {
          let max = 0;
          for (let j = i * blockSize; j < (i + 1) * blockSize && j < channel.length; j++) {
            const value = Math.abs(channel[j]);
            if (value > max) {
              max = value;
            }
          }
          peaks.push(max);
        }

        setResult({ peaks, durationSec: decoded.duration });
      } catch (error) {
        if (!cancelled && (error as Error).name !== "AbortError") {
          setResult(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  return result;
}
