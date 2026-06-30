import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
} from '@xyflow/react'
import type { Connection, Edge as FlowEdge, Node, NodeTypes } from '@xyflow/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addEdge, updateTrack } from '../../db/db'
import type { Edge, Track } from '../../types'
import { useUi } from '../../store/ui'
import { allEdgeTags } from '../../lib/edges'
import { TrackNode } from './TrackNode'

const nodeTypes: NodeTypes = { track: TrackNode }
const PRO_OPTIONS = { hideAttribution: true }

const RATING_COLORS = ['#52525b', '#7e5bb0', '#8b46c9', '#9d54df', '#b07bea', '#c9a4f2']
function ratingColor(rating?: number): string {
  return RATING_COLORS[rating ?? 0] ?? RATING_COLORS[0]
}

function truncate(text: string, n = 28): string {
  return text.length > n ? text.slice(0, n - 1) + '…' : text
}

// Edge label = technique and/or tags (e.g. "bass swap · ?").
function edgeLabel(e: Edge): string | undefined {
  const parts: string[] = []
  if (e.technique) parts.push(truncate(e.technique))
  if ((e.tags ?? []).length) parts.push((e.tags ?? []).join(' '))
  return parts.length ? parts.join(' · ') : undefined
}

function computePositions(
  tracks: Track[],
  edges: Edge[],
  focusId: string | null,
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()

  if (focusId) {
    // Radial focus layout: center node, outgoing below, incoming above —
    // so "branches below it" reads as where the track flows next.
    pos.set(focusId, { x: 0, y: 0 })
    const outs = edges.filter((e) => e.fromTrackId === focusId).map((e) => e.toTrackId)
    const ins = edges.filter((e) => e.toTrackId === focusId).map((e) => e.fromTrackId)
    const place = (ids: string[], y: number) => {
      const uniq = [...new Set(ids)].filter((id) => id !== focusId)
      uniq.forEach((id, i) => {
        const x = (i - (uniq.length - 1) / 2) * 220
        if (!pos.has(id)) pos.set(id, { x, y })
      })
    }
    place(outs, 240)
    place(ins, -240)
    return pos
  }

  // Whole-graph: use saved positions; lay the rest out on a circle.
  const missing = tracks.filter((t) => !t.position)
  tracks.forEach((t) => {
    if (t.position) pos.set(t.id, t.position)
  })
  const n = Math.max(1, missing.length)
  const r = 180 + missing.length * 18
  missing.forEach((t, i) => {
    const angle = (i / n) * Math.PI * 2
    pos.set(t.id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r })
  })
  return pos
}

function GraphCanvas({ trackIds }: { trackIds?: string[] }) {
  const allTracks = useLiveQuery(() => db.tracks.toArray(), [])
  const allEdges = useLiveQuery(() => db.edges.toArray(), [])

  const focusTrackId = useUi((s) => s.focusTrackId)
  const setFocusTrack = useUi((s) => s.setFocusTrack)
  const selectTrack = useUi((s) => s.selectTrack)
  const selectedTrackId = useUi((s) => s.selectedTrackId)
  const [focusMode, setFocusMode] = useState(false)
  const [edgeTag, setEdgeTag] = useState<string | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<FlowEdge>([])
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()

  // Scope the graph to the current collection's tracks (undefined = whole library).
  const scope = useMemo(() => (trackIds ? new Set(trackIds) : null), [trackIds])
  const tracks = useMemo(
    () => (scope ? (allTracks ?? []).filter((t) => scope.has(t.id)) : allTracks),
    [allTracks, scope],
  )
  const edges = useMemo(() => {
    if (!allEdges) return allEdges
    let list = allEdges
    if (scope) list = list.filter((e) => scope.has(e.fromTrackId) && scope.has(e.toTrackId))
    if (edgeTag) list = list.filter((e) => (e.tags ?? []).includes(edgeTag))
    return list
  }, [allEdges, scope, edgeTag])
  const edgeTagOptions = useMemo(() => allEdgeTags(allEdges ?? []), [allEdges])

  const activeFocus = focusMode ? focusTrackId : null
  const focusedTrack = useMemo(
    () => tracks?.find((t) => t.id === focusTrackId) ?? null,
    [tracks, focusTrackId],
  )

  useEffect(() => {
    if (!tracks || !edges) return

    let visibleTracks = tracks
    if (activeFocus) {
      const keep = new Set<string>([activeFocus])
      edges.forEach((e) => {
        if (e.fromTrackId === activeFocus) keep.add(e.toTrackId)
        if (e.toTrackId === activeFocus) keep.add(e.fromTrackId)
      })
      visibleTracks = tracks.filter((t) => keep.has(t.id))
    } else if (edgeTag) {
      // Edge-tag filter: show just the tagged transitions and the tracks they connect.
      const keep = new Set<string>()
      edges.forEach((e) => {
        keep.add(e.fromTrackId)
        keep.add(e.toTrackId)
      })
      visibleTracks = tracks.filter((t) => keep.has(t.id))
    }

    const pos = computePositions(tracks, edges, activeFocus)
    const newNodes: Node[] = visibleTracks.map((t) => ({
      id: t.id,
      type: 'track',
      position: pos.get(t.id) ?? { x: 0, y: 0 },
      data: { track: t, isFocus: t.id === activeFocus || t.id === selectedTrackId },
    }))

    const visibleIds = new Set(newNodes.map((n) => n.id))
    const newEdges: FlowEdge[] = edges
      .filter((e) => visibleIds.has(e.fromTrackId) && visibleIds.has(e.toTrackId))
      .map((e) => ({
        id: e.id,
        source: e.fromTrackId,
        target: e.toTrackId,
        label: edgeLabel(e),
        markerEnd: { type: MarkerType.ArrowClosed, color: ratingColor(e.rating) },
        style: { stroke: ratingColor(e.rating), strokeWidth: e.rating ? 1 + e.rating * 0.4 : 1.5 },
        labelStyle: { fill: '#d4d4d8', fontSize: 10 },
        labelBgStyle: { fill: '#1c1c21', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
      }))

    setNodes(newNodes)
    setFlowEdges(newEdges)
  }, [tracks, edges, activeFocus, edgeTag, selectedTrackId, setNodes, setFlowEdges])

  // Refit once React Flow has measured the nodes. `useNodesInitialized` flips
  // false→true when a new set of nodes finishes measuring, so this also refits
  // when the visible set changes (collection switch / focus / re-center).
  useEffect(() => {
    if (!nodesInitialized) return
    fitView({ padding: 0.25, duration: 300 })
  }, [nodesInitialized, activeFocus, focusMode, edgeTag, nodes.length, fitView])

  const onNodeClick = useCallback(
    (_evt: unknown, node: Node) => {
      selectTrack(node.id)
      if (focusMode) setFocusTrack(node.id)
    },
    [focusMode, selectTrack, setFocusTrack],
  )

  const onNodeDragStop = useCallback((_evt: unknown, node: Node) => {
    void updateTrack(node.id, { position: node.position })
  }, [])

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target && c.source !== c.target) {
      void addEdge({ fromTrackId: c.source, toTrackId: c.target })
    }
  }, [])

  const toggleFocus = () => {
    const next = !focusMode
    setFocusMode(next)
    if (next && !focusTrackId) {
      setFocusTrack(selectedTrackId ?? tracks?.[0]?.id ?? null)
    }
  }

  const empty = tracks && tracks.length === 0

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        proOptions={PRO_OPTIONS}
      >
        <Background color="#2a2a31" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="#3f3f46" maskColor="rgba(0,0,0,0.6)" />
      </ReactFlow>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-edge bg-panel/90 px-2.5 py-1.5 backdrop-blur">
          <button
            onClick={toggleFocus}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              focusMode ? 'bg-accent text-white' : 'bg-panel2 text-zinc-300 hover:bg-edge'
            }`}
          >
            Focus mode {focusMode ? 'on' : 'off'}
          </button>
          {focusMode && focusedTrack && (
            <span className="text-xs text-zinc-400">
              centered on <span className="text-zinc-100">{focusedTrack.title}</span>
            </span>
          )}
          {edgeTagOptions.length > 0 && (
            <select
              value={edgeTag ?? ''}
              onChange={(e) => setEdgeTag(e.target.value || null)}
              className="rounded border border-edge bg-panel2 px-1.5 py-1 text-xs text-zinc-300"
              title="Show only transitions with this tag"
            >
              <option value="">All edges</option>
              {edgeTagOptions.map((t) => (
                <option key={t} value={t}>
                  edge: {t}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="pointer-events-none max-w-[15rem] text-[11px] leading-snug text-zinc-500">
          {focusMode
            ? 'Click a neighbor to re-center. Outgoing transitions sit below, incoming above.'
            : 'Click a node to inspect it. Drag a handle between nodes to add a transition.'}
        </p>
      </div>

      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          No tracks in this view.
        </div>
      )}
    </div>
  )
}

export function GraphView({ trackIds }: { trackIds?: string[] }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas trackIds={trackIds} />
    </ReactFlowProvider>
  )
}
