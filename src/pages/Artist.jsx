import { useAsync } from '../hooks.js'
import {
  getArtistMeta, getArtistAppearances, getArtistCounts, getArtistAlongside, getArtistFamily,
  getArtistAftershows, getArtistEvents, getSetTimes,
} from '../api.js'
import { Spinner, ErrorBox, Empty, Section, Photo, TrackStar, Link } from '../components/ui.jsx'
import { enc } from '../router.js'
import { fmtDay, fmtTimeRange, safeUrl, socialUrl, todayStr } from '../util.js'

const CHANGE = { time_change: 'Time changed', shortened_set: 'Shortened set', hold: 'On hold' }

export default function Artist({ name }) {
  const meta = useAsync(() => getArtistMeta(name), [name])
  const apps = useAsync(() => getArtistAppearances(name), [name])
  const counts = useAsync(() => getArtistCounts(name), [name])
  const along = useAsync(() => getArtistAlongside(name), [name])
  const fam = useAsync(() => getArtistFamily(name), [name])
  const after = useAsync(() => getArtistAftershows(name), [name])
  const events = useAsync(() => (meta.data?.id ? getArtistEvents(meta.data.id) : []), [meta.data?.id])
  const times = useAsync(async () => {
    const ids = (apps.data || []).map((a) => a.row_num).filter(Boolean)
    return ids.length ? getSetTimes(ids) : new Map()
  }, [apps.data])

  const m = meta.data
  const links = m
    ? [
        ['Website', socialUrl('website', m.website)],
        ['Instagram', socialUrl('instagram', m.instagram)],
        ['X', socialUrl('twitter', m.twitter)],
        ['Facebook', socialUrl('facebook', m.facebook)],
        ['YouTube', socialUrl('youtube', m.youtube)],
        ['TikTok', socialUrl('tiktok', m.tiktok)],
      ].filter(([, u]) => u)
    : []

  const today = todayStr()
  const rows = (apps.data || []).filter((a) => a.drop !== 'Y' && a.change_type !== 'cancellation')
  const dateOf = (a) => a.festival_date || a.festival_start_date || `${a.year}-01-01`
  const upcoming = rows.filter((a) => dateOf(a) >= today).sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
  const past = rows.filter((a) => dateOf(a) < today)

  const Appearance = ({ a }) => {
    const t = times.data?.get(a.row_num)
    const time = t ? fmtTimeRange(t.start_time, t.effective_end_time) : a.set_time || ''
    const others = (a.collab_artist_names || []).filter((n) => n.toLowerCase() !== name.toLowerCase())
    return (
      <div class="list-item">
        <div class="grow">
          <a class="title" href={`#/festival/${enc(a.festival_name)}?year=${a.year}&tab=schedule`}>
            {a.festival_name} {a.year}
          </a>
          <div class="muted small">
            {[a.festival_date && fmtDay(a.festival_date), a.stage_name, time].filter(Boolean).join(' · ')}
          </div>
          {others.length > 0 && <div class="muted small">with {others.join(', ')}</div>}
        </div>
        {a.slot === 'HEADLINER' && <span class="badge">HEADLINER</span>}
        {a.change_type && CHANGE[a.change_type] && <span class="tag changed">{CHANGE[a.change_type]}</span>}
      </div>
    )
  }

  return (
    <>
      <div class="page-head">
        <Photo src={m?.deezer_image_url} name={name} size={120} round />
        <div class="grow">
          <div class="row" style="gap:.4rem"><h1>{name}</h1><TrackStar name={name} /></div>
          {m && (m.origin_city || m.origin_country) && (
            <div class="muted">{[m.origin_city, m.origin_country].filter(Boolean).join(', ')}</div>
          )}
          {links.length > 0 && (
            <div class="links">
              {links.map(([l, u]) => <a key={l} href={u} target="_blank" rel="noopener noreferrer">{l} ↗</a>)}
            </div>
          )}
          {fam.data?.length > 0 && (
            <div class="chips" style="margin-top:.6rem">
              {fam.data.map((f) => (
                <a key={f.role + f.artist_name} class="chip" href={'#/artist/' + enc(f.artist_name)}>
                  {f.role === 'parent' ? (f.relation === 'side_project' ? 'Side project of ' : 'Member of ') : (f.relation === 'side_project' ? 'Side project: ' : 'Member: ')}
                  {f.artist_name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <Section title="Upcoming festival sets">
        {apps.loading ? <Spinner /> : apps.error ? <ErrorBox error={apps.error} /> : upcoming.length === 0 ? (
          <Empty>No upcoming festival dates announced.</Empty>
        ) : <div class="list">{upcoming.map((a) => <Appearance key={a.row_num} a={a} />)}</div>}
      </Section>

      {(events.data || []).length > 0 && (
        <Section title="Upcoming shows">
          <div class="list">
            {events.data.map((e, i) => {
              const url = safeUrl(e.ticket_url)
              return (
                <div class="list-item" key={i}>
                  <div class="grow">
                    <div class="title">{e.venue_name}</div>
                    <div class="muted small">{[fmtDay(e.event_date), e.venue_city, e.venue_country].filter(Boolean).join(' · ')}</div>
                  </div>
                  {url && <a class="btn small" href={url} target="_blank" rel="noopener noreferrer">Tickets ↗</a>}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {(after.data || []).length > 0 && (
        <Section title="Aftershows">
          <div class="list">
            {after.data.map((a, i) => (
              <div class="list-item" key={i}>
                <div class="grow">
                  <a class="title" href={`#/festival/${enc(a.festival)}?year=${a.year}&tab=aftershows`}>{a.festival} {a.year}</a>
                  <div class="muted small">{[fmtDay(a.date), a.venue_name, a.venue_city].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div class="grid two">
        <Section title="Festival history">
          {counts.loading ? <Spinner /> : (counts.data || []).length === 0 ? <Empty>No history.</Empty> : (
            <div class="card">
              {(() => {
                const max = Math.max(1, ...counts.data.map((c) => c.appearances))
                return counts.data.slice(0, 12).map((c) => (
                  <div class="bar" key={c.festival}>
                    <a class="label" href={'#/festival/' + enc(c.festival)}>{c.festival}</a>
                    <div class="track"><div class="fill" style={{ width: (c.appearances / max) * 100 + '%' }} /></div>
                    <div class="val">{c.appearances}×</div>
                  </div>
                ))
              })()}
            </div>
          )}
        </Section>
        <Section title="Often on the same bill">
          {along.loading ? <Spinner /> : (along.data || []).length === 0 ? <Empty>Nothing yet.</Empty> : (
            <div class="chips">
              {along.data.map((a) => (
                <a key={a.artist_name} class="chip" href={'#/artist/' + enc(a.artist_name)}>
                  {a.artist_name} · {a.shared_lineups}
                </a>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Past festival sets">
        {apps.loading ? <Spinner /> : past.length === 0 ? <Empty>No past sets on record.</Empty> : (
          <div class="list">{past.map((a) => <Appearance key={a.row_num} a={a} />)}</div>
        )}
      </Section>
    </>
  )
}
