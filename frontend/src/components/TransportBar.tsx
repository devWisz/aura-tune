"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  Mic,
  MicOff,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Split,
} from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { audioEngine } from "@/lib/audio/audioEngine";
import { toast } from "@/store/useToastStore";
import { Button, Chip } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/**
 * Owns the single `<audio>` element for the studio.
 *
 * It has to be a single persistent element: `createMediaElementSource` can only
 * wrap a given element once, so tracks are swapped by changing `src` rather than
 * by mounting new elements.
 */
export const TransportBar: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seekingRef = useRef(false);

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);

  const {
    tracks,
    currentTrackId,
    addTracks,
    selectTrack,
    isPlaying,
    setIsPlaying,
    isMicActive,
    toggleMic,
    eqBypassed,
    toggleEQBypass,
    masterVolume,
    setMasterVolume,
    toggleMute,
    toggleNoise,
    setVisualizerMode,
    refreshEngineStatus,
  } = useAudioStore();

  const currentTrack = tracks.find((t) => t.id === currentTrackId) ?? null;
  const currentIndex = tracks.findIndex((t) => t.id === currentTrackId);

  /* ---------------- Playback plumbing ---------------- */

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) {
      fileInputRef.current?.click();
      return;
    }
    audioEngine.init();
    audioEngine.connectAudioElement(audio);
    await audioEngine.resume();
    try {
      await audio.play();
      setIsPlaying(true);
      refreshEngineStatus();
    } catch (err) {
      toast.error("Playback blocked", (err as Error).message);
    }
  }, [setIsPlaying, refreshEngineStatus]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, [setIsPlaying]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else void play();
  }, [isPlaying, pause, play]);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (tracks.length === 0) return;
      if (shuffle && tracks.length > 1) {
        let next = currentIndex;
        while (next === currentIndex) next = Math.floor(Math.random() * tracks.length);
        selectTrack(tracks[next].id);
        return;
      }
      const next = (currentIndex + direction + tracks.length) % tracks.length;
      selectTrack(tracks[next].id);
    },
    [tracks, currentIndex, shuffle, selectTrack]
  );

  const seekBy = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  }, []);

  // Swap the source when the selected track changes, auto-resuming if we were
  // already playing so skipping tracks feels continuous.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.dataset.trackId === currentTrack.id) return;

    const wasPlaying = isPlaying;
    audio.dataset.trackId = currentTrack.id;
    audio.src = currentTrack.url;
    audio.load();
    if (wasPlaying) void play();
    // `isPlaying` is intentionally omitted: this must run on track change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  /* ---------------- Media Session (OS / headphone buttons) ---------------- */
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack?.name ?? "AuraTune DSP Studio",
      artist: isMicActive ? "Live microphone input" : "Local file",
      album: "AuraTune",
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void play()],
      ["pause", () => pause()],
      ["previoustrack", () => step(-1)],
      ["nexttrack", () => step(1)],
      ["seekbackward", () => seekBy(-10)],
      ["seekforward", () => seekBy(10)],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* not every action is supported everywhere */
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [currentTrack?.name, isPlaying, isMicActive, play, pause, step, seekBy]);

  /* ---------------- Keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Never hijack typing, and leave range inputs their own arrow handling.
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight": e.preventDefault(); seekBy(5); break;
        case "ArrowLeft": e.preventDefault(); seekBy(-5); break;
        case "ArrowUp":
          e.preventDefault();
          setMasterVolume(Math.min(1, masterVolume + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          setMasterVolume(Math.max(0, masterVolume - 0.05));
          break;
        case "m": case "M": toggleMute(); break;
        case "b": case "B": toggleEQBypass(); break;
        case "n": case "N": toggleNoise(); break;
        case "[": step(-1); break;
        case "]": step(1); break;
        case "1": setVisualizerMode("spectrum"); break;
        case "2": setVisualizerMode("waveform"); break;
        case "3": setVisualizerMode("circular"); break;
        case "4": setVisualizerMode("waterfall"); break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay, seekBy, masterVolume, setMasterVolume, toggleMute,
    toggleEQBypass, toggleNoise, step, setVisualizerMode,
  ]);

  /* ---------------- Drag & drop anywhere on the page ---------------- */
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files?.length) {
        const first = addTracks(e.dataTransfer.files);
        if (first) {
          selectTrack(first.id);
          void play();
        }
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addTracks, selectTrack, play]);

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <>
      <audio
        ref={audioRef}
        className="hidden"
        onTimeUpdate={(e) => {
          if (!seekingRef.current) setPosition(e.currentTarget.currentTime);
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (repeat && audioRef.current) {
            audioRef.current.currentTime = 0;
            void play();
          } else if (tracks.length > 1) {
            step(1);
          } else {
            setIsPlaying(false);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (!e.target.files?.length) return;
          const first = addTracks(e.target.files);
          if (first) {
            selectTrack(first.id);
            void play();
          }
          e.target.value = "";
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-bg/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-accent/60 bg-accent/5 px-10 py-8 text-center">
            <p className="text-[15px] font-semibold text-ink">Drop audio to load</p>
            <p className="mt-1 text-[12px] text-faint">MP3, WAV, FLAC, OGG or M4A</p>
          </div>
        </div>
      )}

      <div className="at-panel flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        {/* Transport buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => step(-1)}
            disabled={tracks.length < 2}
            aria-label="Previous track"
            className="at-focus rounded-lg p-2 text-faint transition-colors hover:text-ink disabled:opacity-30"
          >
            <SkipBack size={15} />
          </button>

          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="at-focus grid h-10 w-10 place-items-center rounded-full bg-accent text-[#04121a] transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
          </button>

          <button
            onClick={() => step(1)}
            disabled={tracks.length < 2}
            aria-label="Next track"
            className="at-focus rounded-lg p-2 text-faint transition-colors hover:text-ink disabled:opacity-30"
          >
            <SkipForward size={15} />
          </button>
        </div>

        {/* Track title + scrubber */}
        <div className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[12px] font-medium text-ink">
              {currentTrack?.name ?? (isMicActive ? "Live microphone input" : "No track loaded")}
            </span>
            <span className="at-mono shrink-0 text-[11px] text-faint">
              {formatTime(position)} / {formatTime(duration)}
            </span>
          </div>

          <input
            type="range"
            className="at-slider w-full"
            min={0}
            max={duration || 1}
            step={0.01}
            value={position}
            aria-label="Seek"
            disabled={!currentTrack}
            onPointerDown={() => (seekingRef.current = true)}
            onPointerUp={() => (seekingRef.current = false)}
            onChange={(e) => {
              const next = parseFloat(e.target.value);
              setPosition(next);
              if (audioRef.current) audioRef.current.currentTime = next;
            }}
            style={{ "--fill": `${progress}%` } as React.CSSProperties}
          />
        </div>

        {/* Secondary controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            active={repeat}
            variant="ghost"
            onClick={() => setRepeat((r) => !r)}
            aria-label="Repeat"
            className="px-2"
          >
            <Repeat size={14} />
          </Button>
          <Button
            active={shuffle}
            variant="ghost"
            onClick={() => setShuffle((s) => !s)}
            aria-label="Shuffle"
            className="px-2"
          >
            <Shuffle size={14} />
          </Button>

          <Button onClick={() => fileInputRef.current?.click()}>
            <FolderOpen size={13} /> Load
          </Button>

          <Button active={isMicActive} onClick={() => void toggleMic()}>
            {isMicActive ? <Mic size={13} /> : <MicOff size={13} />}
            {isMicActive ? "Mic live" : "Mic"}
          </Button>

          {/* A/B — the single most useful control when tuning an EQ */}
          <Button
            onClick={toggleEQBypass}
            className={cn(
              eqBypassed && "border-warm/50 bg-warm/10 text-warm"
            )}
            title="Compare processed and unprocessed audio (B)"
          >
            <Split size={13} />
            {eqBypassed ? "Bypassed" : "A/B"}
          </Button>

          {isMicActive && <Chip tone="warn" pulse>Mic</Chip>}
        </div>
      </div>
    </>
  );
};
