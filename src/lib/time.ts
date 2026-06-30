// Format seconds as m:ss (or h:mm:ss for long tracks).
export function formatTime(totalSec: number | undefined | null): string {
  if (totalSec == null || !isFinite(totalSec) || totalSec < 0) return '–'
  const sec = Math.floor(totalSec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Parse "m:ss", "h:mm:ss", or a plain seconds count. Returns null if unparseable.
export function parseTime(input: string): number | null {
  const t = input.trim()
  if (t === '') return null
  if (/^\d+$/.test(t)) return parseInt(t, 10)
  const parts = t.split(':')
  if (parts.length < 2 || parts.length > 3) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return null
  if (parts.length === 2) return nums[0] * 60 + nums[1]
  return nums[0] * 3600 + nums[1] * 60 + nums[2]
}
