import type { Track } from '../../types'
import { formatTime } from '../../lib/time'

export function TrackGrid({
  tracks,
  annCount,
  edgeCount,
  onCardClick,
}: {
  tracks: Track[]
  annCount: Map<string, number>
  edgeCount: Map<string, number>
  onCardClick: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
      {tracks.map((t) => (
        <button
          key={t.id}
          onClick={() => onCardClick(t.id)}
          className="group flex flex-col overflow-hidden rounded-lg border border-edge bg-panel text-left transition hover:border-accent/60 hover:bg-panel2"
        >
          <div className="relative aspect-square w-full bg-panel2">
            {t.albumArtUrl ? (
              <img src={t.albumArtUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl text-zinc-700">♪</div>
            )}
            {t.energy != null && (
              <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                E{t.energy}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-2.5">
            <div className="truncate text-sm font-medium text-zinc-100">{t.title}</div>
            <div className="truncate text-xs text-zinc-400">{t.artist}</div>
            <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
              {t.bpm != null && <span>{t.bpm} BPM</span>}
              {t.key && <span className="text-violet-300">{t.key}</span>}
              {t.durationSec != null && <span>{formatTime(t.durationSec)}</span>}
            </div>
            {t.tags.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {t.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-violet-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-auto flex gap-3 pt-1.5 text-[11px] text-zinc-500">
              <span>{annCount.get(t.id) ?? 0} notes</span>
              <span>{edgeCount.get(t.id) ?? 0} transitions</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
