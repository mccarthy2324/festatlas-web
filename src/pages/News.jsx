import { useMemo, useState } from 'preact/hooks'
import { useAsync } from '../hooks.js'
import { getNews } from '../api.js'
import { Spinner, ErrorBox, Empty, Pills } from '../components/ui.jsx'
import { relativeTime, safeUrl } from '../util.js'
import { enc } from '../router.js'

const CATS = {
  lineup_drop: ['Lineup Drop', '#5c6bff'],
  artist_added: ['Artist Added', '#34d399'],
  artist_drop: ['Artist Drop', '#f87171'],
  schedule_drop: ['Schedule Drop', '#d6a35c'],
  schedule_change: ['Schedule Change', '#fb923c'],
  aftershows_added: ['Aftershows Added', '#a78bfa'],
  day_breakdown: ['Day Breakdown', '#26a68c'],
  backlog_update: ['Backlog Update', '#4a8dd9'],
  general: ['News', '#9aa0c8'],
}
const cat = (c) => CATS[c] || CATS.general

function Cat({ c }) {
  const [label, color] = cat(c)
  return <span class="cat" style={{ background: color + '24', color }}>{label}</span>
}

export function NewsCard({ item, onOpen }) {
  const images = (item.images || []).map(safeUrl).filter(Boolean)
  const tags = [...(item.festival_tags || []), ...(item.artist_tags || [])]
  return (
    <button class="news-card" onClick={() => onOpen?.(item)} style={onOpen ? '' : 'cursor:default'}>
      <div class="row" style="justify-content:space-between">
        <Cat c={item.category} />
        <span class="muted small">{relativeTime(item.created_at)}</span>
      </div>
      <div style="font-weight:700;margin-top:.5rem">{item.headline}</div>
      {tags.length > 0 && (
        <div class="chips" style="margin-top:.5rem">
          {tags.slice(0, 6).map((t) => <span class="chip small" key={t}>{t}</span>)}
          {tags.length > 6 && <span class="chip small">+{tags.length - 6}</span>}
        </div>
      )}
      {images.length > 0 && (
        <div class="thumbs">{images.slice(0, 3).map((s) => <img key={s} src={s} alt="" loading="lazy" referrerpolicy="no-referrer" />)}</div>
      )}
    </button>
  )
}

function NewsModal({ item, onClose }) {
  const images = (item.images || []).map(safeUrl).filter(Boolean)
  const link = safeUrl(item.external_url)
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <button class="close" onClick={onClose} aria-label="Close">×</button>
        <div class="row"><Cat c={item.category} /><span class="muted small">{relativeTime(item.created_at)}</span></div>
        <h2 style="margin:.7rem 0">{item.headline}</h2>
        {item.body && <p class="muted pre">{item.body}</p>}
        {images.map((s) => <img key={s} class="full" src={s} alt="" loading="lazy" referrerpolicy="no-referrer" />)}
        {link && <p><a class="btn primary" href={link} target="_blank" rel="noopener noreferrer">View full lineup / article ↗</a></p>}
        {item.festival_tags?.length > 0 && (
          <>
            <div class="muted small" style="margin:.8rem 0 .3rem">FESTIVALS</div>
            <div class="chips">{item.festival_tags.map((f) => <a key={f} class="chip" href={'#/festival/' + enc(f)} onClick={onClose}>{f}</a>)}</div>
          </>
        )}
        {item.artist_tags?.length > 0 && (
          <>
            <div class="muted small" style="margin:.8rem 0 .3rem">ARTISTS</div>
            <div class="chips">{item.artist_tags.map((a) => <a key={a} class="chip" href={'#/artist/' + enc(a)} onClick={onClose}>{a}</a>)}</div>
          </>
        )}
      </div>
    </div>
  )
}

const PAGE = 20

export default function News() {
  const news = useAsync(getNews, [])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState(null)

  const categories = useMemo(() => [...new Set((news.data || []).map((n) => n.category))], [news.data])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (news.data || []).filter((n) => {
      if (category !== 'all' && n.category !== category) return false
      if (!s) return true
      return (
        n.headline.toLowerCase().includes(s) ||
        (n.festival_tags || []).some((t) => t.toLowerCase().includes(s)) ||
        (n.artist_tags || []).some((t) => t.toLowerCase().includes(s))
      )
    })
  }, [news.data, q, category])

  return (
    <>
      <h1>Updates</h1>
      <div class="row" style="margin:1rem 0">
        <input class="input" style="max-width:320px" placeholder="Search headlines, artists, festivals…" value={q}
          onInput={(e) => { setQ(e.currentTarget.value); setShown(PAGE) }} />
        <Pills value={category} onChange={(c) => { setCategory(c); setShown(PAGE) }}
          options={[{ id: 'all', label: 'All' }, ...categories.map((c) => ({ id: c, label: cat(c)[0] }))]} />
      </div>
      {news.loading ? <Spinner /> : news.error ? <ErrorBox error={news.error} /> : filtered.length === 0 ? (
        <Empty>No updates match.</Empty>
      ) : (
        <>
          <div class="list">{filtered.slice(0, shown).map((n) => <NewsCard key={n.id} item={n} onOpen={setOpen} />)}</div>
          {shown < filtered.length && (
            <p style="text-align:center"><button class="btn" onClick={() => setShown(shown + PAGE)}>Show more</button></p>
          )}
        </>
      )}
      {open && <NewsModal item={open} onClose={() => setOpen(null)} />}
    </>
  )
}
