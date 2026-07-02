// Subsequence fuzzy match for the command palette. Returns a score (higher =
// better) if every character of `needle` appears in order within `hay`
// (case-insensitive), else null. Rewards contiguous runs and start-of-word hits.
// Plain text matching — no music intelligence, nothing "assistive".
export function fuzzyScore(hay: string, needle: string): number | null {
  const n = needle.trim().toLowerCase()
  if (n === '') return 0
  const h = hay.toLowerCase()
  let hi = 0
  let score = 0
  let run = 0
  for (let ni = 0; ni < n.length; ni++) {
    const c = n[ni]
    let found = -1
    for (let k = hi; k < h.length; k++) {
      if (h[k] === c) {
        found = k
        break
      }
    }
    if (found === -1) return null
    let charScore = 1
    if (found === hi) {
      run++
      charScore += run // contiguous with the previous match
    } else {
      run = 0
    }
    if (found === 0 || h[found - 1] === ' ' || h[found - 1] === '-') charScore += 3 // start of word
    score += charScore
    hi = found + 1
  }
  return score
}
