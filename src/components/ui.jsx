import { useState } from 'preact/hooks'
import { enc } from '../router.js'
import { initials, fmtRange, daysUntil, safeUrl } from '../util.js'
import { useUser } from '../userdata.jsx'

export const Link = ({ to, children, class: cls, ...rest }) => (
  <a href={'#' + to} class={cls} {...rest}>{children}</a>
)

export const Spinner = ({ label = 'Loading…' }) => (
  <div class="center muted"><div class="spinner" /> <span>{label}</span></div>
)

export const ErrorBox = ({ error, retry }) => (
  <div class="card error">
    <strong>Something went wrong.</strong>
    <div class="muted small">{error?.message || String(error)}</div>
    {retry && <button class="btn small" onClick={retry}>Try again</button>}
  </div>
)

export const Empty = ({ children }) => <div class="empty muted">{children}</div>

export function Section({ title, action, children }) {
  return (
    <section class="section">
      <div class="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div class="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          class={'tab' + (value === t.id ? ' on' : '')}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Pills({ options, value, onChange }) {
  return (
    <div class="pills">
      {options.map((o) => (
        <button key={o.id} class={'pill' + (value === o.id ? ' on' : '')} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Photo({ src, name, round = false, size = 64 }) {
  const [bad, setBad] = useState(false)
  const url = safeUrl(src)
  const style = { width: size, height: size }
  if (!url || bad) {
    return <div class={'photo ph' + (round ? ' round' : '')} style={style}>{initials(name)}</div>
  }
  return (
    <img
      class={'photo' + (round ? ' round' : '')}
      style={style}
      src={url}
      alt={name}
      loading="lazy"
      referrerpolicy="no-referrer"
      onError={() => setBad(true)}
    />
  )
}

export function FestLogo({ fest, size = 72 }) {
  return <Photo src={fest?.logo} name={fest?.festival} size={size} />
}

export function TrackStar({ name, kind = 'artist', small }) {
  const u = useUser()
  const on = kind === 'artist' ? u.isArtistTracked(name) : u.isFestivalTracked(name)
  const toggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    kind === 'artist' ? u.toggleArtist(name) : u.toggleFestival(name)
  }
  return (
    <button
      class={'star' + (on ? ' on' : '') + (small ? ' small' : '')}
      onClick={toggle}
      aria-pressed={on}
      title={on ? 'Stop tracking' : 'Track'}
    >
      {on ? '★' : '☆'}
    </button>
  )
}

export function ArtistCard({ name, image, badge }) {
  const u = useUser()
  const tracked = u.isArtistTracked(name)
  return (
    <a class={'artist-card' + (tracked ? ' tracked' : '')} href={'#/artist/' + enc(name)}>
      <Photo src={image} name={name} size={120} />
      <div class="artist-name">{name}</div>
      {badge && <div class="badge">{badge}</div>}
      <TrackStar name={name} small />
    </a>
  )
}

export function FestCard({ fest }) {
  const d = fest.next ? daysUntil(fest.next.start) : null
  return (
    <a class="fest-card" href={'#/festival/' + enc(fest.festival)}>
      <FestLogo fest={fest} size={84} />
      <div class="fest-info">
        <div class="fest-name">{fest.festival}</div>
        <div class="muted small">
          {fest.next
            ? fmtRange(fest.next.start, fest.next.end)
            : fest.month
            ? `Usually ${fest.month}`
            : 'Dates TBA'}
        </div>
        <div class="muted small">{[fest.city, fest.country].filter(Boolean).join(', ')}</div>
        {fest.next?.isNow && <span class="tag live">Happening now</span>}
        {!fest.next?.isNow && d != null && d >= 0 && d <= 60 && <span class="tag soon">In {d} day{d === 1 ? '' : 's'}</span>}
        {fest.status && fest.status !== 'active' && <span class="tag dim">{fest.status}</span>}
      </div>
    </a>
  )
}
