"use client";

import React from "react";
import { ListMusic, Music, Play, Trash2 } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { EmptyState, Panel } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export const PlaylistPanel: React.FC = () => {
  const { tracks, currentTrackId, selectTrack, removeTrack, isPlaying } = useAudioStore();

  return (
    <Panel
      title="Queue"
      subtitle={tracks.length === 1 ? "1 track loaded" : `${tracks.length} tracks loaded`}
      icon={<ListMusic size={15} />}
      bodyClassName="space-y-1.5"
    >
      {tracks.length === 0 ? (
        <EmptyState
          icon={<Music size={20} />}
          title="Nothing queued yet"
          body="Drop audio files anywhere on this page, or use Load in the transport bar. Files stay on your device — nothing is uploaded."
        />
      ) : (
        tracks.map((track) => {
          const isCurrent = track.id === currentTrackId;
          return (
            <div
              key={track.id}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                isCurrent
                  ? "border-accent/40 bg-accent/[0.07]"
                  : "border-line-soft bg-white/[0.02] hover:border-line"
              )}
            >
              <button
                onClick={() => selectTrack(track.id)}
                className="at-focus flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                {isCurrent && isPlaying ? (
                  <span className="flex h-3.5 w-3.5 shrink-0 items-end gap-[2px]">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-[2px] animate-pulse rounded-sm bg-accent"
                        style={{ height: `${[60, 100, 75][i]}%`, animationDelay: `${i * 140}ms` }}
                      />
                    ))}
                  </span>
                ) : (
                  <Play size={13} className="shrink-0 text-faint" />
                )}
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-[12px]",
                      isCurrent ? "font-medium text-ink" : "text-dim"
                    )}
                  >
                    {track.name}
                  </span>
                  <span className="at-mono block text-[10px] text-faint">{formatSize(track.size)}</span>
                </span>
              </button>

              <button
                onClick={() => removeTrack(track.id)}
                aria-label={`Remove ${track.name}`}
                className="at-focus rounded p-1 text-faint opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })
      )}
    </Panel>
  );
};
