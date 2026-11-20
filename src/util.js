const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pad = (n) => String(n).padStart(2, '0')

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 'YYYY-MM-DD' -> Date at UTC midnight (so formatting never shifts a day)
export function parseDate(s) {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

export function fmtRange(start, end) {
  const s = parseDate(start)
  if (!s) return null
  const e = parseDate(end)
  const sy = s.getUTCFullYear()
  const base = `${MON[s.getUTCMonth()]} ${s.getUTCDate()}`
  if (!e || e.getTime() === s.getTime()) return `${base}, ${sy}`
  const ey = e.getUTCFullYear()
  if (ey !== sy) return `${base}, ${sy} – ${MON[e.getUTCMonth()]} ${e.getUTCDate()}, ${ey}`
  if (e.getUTCMonth() === s.getUTCMonth()) return `${base}–${e.getUTCDate()}, ${sy}`
  return `${base} – ${MON[e.getUTCMonth()]} ${e.getUTCDate()}, ${sy}`
}

export function fmtDay(s) {
  const d = parseDate(s)
  if (!d) return ''
  return `${DOW[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export function fmtMonthYear(s) {
  const d = parseDate(s)
  if (!d) return ''
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function fmtShort(s) {
  const d = parseDate(s)
  if (!d) return ''
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export function daysUntil(s) {
  const d = parseDate(s)
  if (!d) return null
  const t = parseDate(todayStr())
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}

// 'YYYY-MM-DDTHH:mm:ss' -> '9:30 PM' (no timezone conversion on purpose:
// set times are local to the festival)
export function fmtTime(ts) {
  if (!ts) return ''
  const m = /T(\d{2}):(\d{2})/.exec(ts)
  if (!m) return ''
  let h = Number(m[1])
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m[2]} ${ap}`
}

export function fmtTimeRange(start, end) {
  const a = fmtTime(start)
  const b = fmtTime(end)
  if (!a) return ''
  return b ? `${a} – ${b}` : a
}

export function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  return (parts[0]?.[0] || '?').concat(parts[1]?.[0] || '').toUpperCase()
}

export function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => '\\' + c)
}

// Calendar date of a weekday name within a festival that starts on `startDt`
export function actualDate(startDt, dayName) {
  const s = parseDate(startDt)
  const target = DAY_NAMES.indexOf(dayName)
  if (!s || target < 0) return null
  const offset = (target - s.getUTCDay() + 7) % 7
  const d = new Date(s.getTime() + offset * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function relativeTime(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return `${MON[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== new Date().getFullYear() ? ', ' + d.getFullYear() : ''}`
}

// Social handles may be stored as bare handles or full URLs
export function socialUrl(kind, v) {
  if (!v) return null
  const s = String(v).trim()
  if (/^https?:\/\//i.test(s)) return s
  const h = s.replace(/^@/, '').replace(/^\/+/, '')
  switch (kind) {
    case 'website':
      return `https://${s.replace(/^\/+/, '')}`
    case 'instagram':
      return `https://instagram.com/${h}`
    case 'twitter':
      return `https://x.com/${h}`
    case 'facebook':
      return `https://facebook.com/${h}`
    case 'tiktok':
      return `https://tiktok.com/@${h}`
    case 'youtube':
      return /^UC[\w-]{20,}$/.test(h) ? `https://youtube.com/channel/${h}` : `https://youtube.com/@${h}`
    default:
      return s
  }
}

export function safeUrl(u) {
  if (!u) return null
  const s = String(u).trim()
  return /^https?:\/\//i.test(s) ? s : null
}
