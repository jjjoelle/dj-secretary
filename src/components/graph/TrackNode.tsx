import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { Track } from '../../types'

// Plain object literal (not an interface) so it satisfies React Flow's
// `Record<string, unknown>` node-data constraint.
export type TrackNodeData = { track: Track; isFocus: boolean }

export function TrackNode({ data }: NodeProps) {
  const { track, isFocus } = data as unknown as TrackNodeData
  return (
    <div
      className={`w-44 rounded-lg border bg-panel px-3 py-2 ${
        isFocus ? 'border-accent ring-2 ring-accent/40' : 'border-edge'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-zinc-500" />
      <div className="truncate text-sm font-medium text-zinc-100">{track.title}</div>
      <div className="truncate text-xs text-zinc-400">{track.artist}</div>
      <div className="mt-1 flex gap-2 text-[10px] text-zinc-500">
        {track.bpm != null && <span>{track.bpm} BPM</span>}
        {track.key && <span className="text-violet-300">{track.key}</span>}
        {track.energy != null && <span className="text-amber-300">E{track.energy}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-zinc-500" />
    </div>
  )
}
