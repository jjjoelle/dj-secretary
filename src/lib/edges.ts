import type { Edge } from '../types'

// Unique, sorted set of all tags used across the given edges.
export function allEdgeTags(edges: Edge[]): string[] {
  const set = new Set<string>()
  edges.forEach((e) => (e.tags ?? []).forEach((t) => set.add(t)))
  return [...set].sort()
}

// Edges carrying ALL of the given tags (AND). Empty selection = all edges.
export function edgesWithTags(edges: Edge[], tags: string[]): Edge[] {
  if (tags.length === 0) return edges
  return edges.filter((e) => tags.every((t) => (e.tags ?? []).includes(t)))
}
