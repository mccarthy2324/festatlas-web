import { useEffect, useMemo, useState } from 'preact/hooks'
import { useAsync } from '../hooks.js'
import {
  getFestivalIndex, getLineupYears, getLineup, getSchedule, getAftershows, getPoster,
  getTopArtists, getTopCrossovers,
} from '../api.js'
import { Spinner, ErrorBox, Empty, Tabs, Pills, Section, FestLogo, TrackStar, ArtistCard, Link } from '../components/ui.jsx'
import { useUser } from '../userdata.jsx'
import { enc } from '../router.js'
import { fmtRange, fmtTimeRange, fmtDay, fmtTime, safeUrl, socialUrl, todayStr, actualDate } from '../util.js'

const TABS = [
  { id: 'lineup', label: 'Lineup' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'aftershows', label: 'Aftershows' },
  { id: 'poster', label: 'Poster' },
  { id: 'insights', label: 'Insights' },
]

export default function FestivalDetail({ name, params }) {
  const idx = useAsync(getFestivalIndex, [])
  if (idx.loading) return <Spinner />
  if (idx.error) return <ErrorBox error={idx.error} />
  const fest = idx.data.byKey.get(String(name).toLowerCase())
  if (!fest) return <Empty>We couldn’t find “{name}”. <Link to="/festivals">Browse all festivals</Link></Empty>
  return <Body key={fest.key} fest={fest} params={params} />
}

function Body({ fest, params }) {
  const lyears = useAsync(() => getLineupYears(fest.festival), [fest.festival])
  const [tab, setTab] = useState(TABS.some((t) => t.id === params.tab) ? params.tab : 'lineup')
  const [year, setYear] = useState(params.year ? Number(params.year) : null)

  const years = useMemo(() => {
    const m = new Map()
    ;(lyears.data || []).forEach((y) => m.set(y.year, y.count))
    fest.years.forEach((y) => { if (!m.has(y)) m.set(y, null) })
    return [...m.entries()].sort((a, b) => b[0] - a[0])
  }, [lyears.data, fest])

  // pick a sensible default year once we know which years have lineups
  useEffect(() => {
    if (year != null || lyears.loading) return
    const withLineup = (lyears.data || []).map((y) => y.year)
    if (fest.next && withLineup.includes(fest.next.year)) setYear(fest.next.year)
    else if (withLineup.length) setYear(withLineup[0])
    else if (fest.years.length) setYear(fest.years[0])
  }, [lyears.loading, lyears.data])

  const links = [
    ['Tickets', safeUrl(fest.tickets_url)],
    ['Map', safeUrl(fest.map_url)],
    ['Website', socialUrl('website', fest.website_url)],
    ['Info', safeUrl(fest.info_url)],
    ['Instagram', socialUrl('instagram', fest.instagram_url)],
    ['X', socialUrl('twitter', fest.twitter_url)],
    ['Facebook', socialUrl('facebook', fest.facebook_url)],
  ].filter(([, u]) => u)

  const goingYear = fest.next?.year && year === fest.next.year ? year : null

  return (
    <>
      <div class="page-head">
        <FestLogo fest={fest} size={96} />
        <div class="grow">
          <div class="row" style="gap:.4rem">
            <h1>{fest.festival}</h1>
            <TrackStar name={fest.festival} kind="festival" />
          </div>
          <div class="muted">{[fest.city, fest.state, fest.country].filter(Boolean).join(', ')}</div>
          <div style="margin-top:.2rem">
            {fest.next ? (
              <>
                <strong>{fmtRange(fest.next.start, fest.next.end)}</strong>
                {fest.next.isNow && <span class="tag live" style="margin-left:.5rem">Happening now</span>}
              </>
            ) : (
              <span class="muted">{fest.month ? `Usually ${fest.month}` : 'Dates TBA'}</span>
            )}
            {fest.status && fest.status !== 'active' && <span class="tag dim" style="margin-left:.5rem">{fest.status}</span>}
          </div>
          {links.length > 0 && (
            <div class="links">
              {links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}
            </div>
          )}
        </div>
        {goingYear && <GoingControl fest={fest} year={goingYear} />}
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {years.length > 0 && (
        <div class="row" style="margin-bottom:1rem">
          <span class="muted small">Edition</span>
          <select class="input" value={year ?? ''} onChange={(e) => setYear(Number(e.currentTarget.value))}>
            {years.map(([y, c]) => <option key={y} value={y}>{y}{c ? ` · ${c} artists` : ''}</option>)}
          </select>
        </div>
      )}

      {tab === 'insights'
        ? <Insights fest={fest} />
        : year == null
        ? (lyears.loading ? <Spinner /> : <Empty>No lineup has been announced yet.</Empty>)
        : tab === 'lineup' ? <LineupTab fest={fest} year={year} />
        : tab === 'schedule' ? <ScheduleTab fest={fest} year={year} />
        : tab === 'aftershows' ? <AftershowsTab fest={fest} year={year} />
        : <PosterTab fest={fest} year={year} />}
    </>
  )
}

// ───────── Going ─────────
function GoingControl({ fest, year }) {
  const u = useUser()
  const [open, setOpen] = useState(false)
  const weekends = [...new Set(fest.dates.filter((d) => Number(d.year) === year).map((d) => d.weekend).filter((w) => w > 0))].sort()
  const today = todayStr()
  const over = !fest.dates.some((d) => Number(d.year) === year && d.end_dt >= today)
  if (over) return null
  const cur = u.goingFor(fest.festival, year)

  if (cur.length) {
    const ws = cur.map((c) => c.weekend).filter((w) => w > 0)
    const label = weekends.length > 1 && ws.length ? ' · ' + ws.map((w) => 'W' + w).join(' + ') : ''
    return (
      <div class="row">
        <span class="tag live">Going{label}</span>
        <button class="btn small" onClick={() => u.clearGoing(fest.festival, year)}>Not going</button>
      </div>
    )
  }
  if (open && weekends.length > 1) {
    return (
      <div class="row">
        {weekends.map((w) => (
          <button key={w} class="btn small" onClick={() => { setOpen(false); u.setGoingFor(fest.festival, year, [w]) }}>Weekend {w}</button>
        ))}
        <button class="btn small primary" onClick={() => { setOpen(false); u.setGoingFor(fest.festival, year, weekends) }}>Both</button>
      </div>
    )
  }
  return (
    <button class="btn primary" onClick={() => (weekends.length > 1 ? setOpen(true) : u.setGoingFor(fest.festival, year, [weekends[0] || 0]))}>
      I’m going
    </button>
  )
}

// ───────── Lineup ─────────
function LineupTab({ fest, year }) {
  const lineup = useAsync(() => getLineup(fest.festival, year), [fest.festival, year])
  const [mode, setMode] = useState('grid')
  const [q, setQ] = useState('')
  if (lineup.loading) return <Spinner />
  if (lineup.error) return <ErrorBox error={lineup.error} />
  const all = (lineup.data || []).filter((a) => !q.trim() || a.artist_name.toLowerCase().includes(q.trim().toLowerCase()))
  if (!lineup.data?.length) return <Empty>No lineup for {year} yet.</Empty>
  const heads = all.filter((a) => a.is_headliner)
  const rest = all.filter((a) => !a.is_headliner)

  const grid = (list) => (
    <div class="grid artists">
      {list.map((a) => <ArtistCard key={a.artist_name} name={a.artist_name} image={a.deezer_image_url} />)}
    </div>
  )
  const compact = (list) => (
    <div class="list">
      {list.map((a) => (
        <a key={a.artist_name} class="list-item" href={'#/artist/' + enc(a.artist_name)}>
          <div class="grow">
            <div class="title">{a.artist_name}</div>
            <div class="muted small">{a.set_count} set{a.set_count === 1 ? '' : 's'}{a.first_date ? ' · ' + fmtDay(a.first_date) : ''}</div>
          </div>
          <TrackStar name={a.artist_name} small />
        </a>
      ))}
    </div>
  )
  const render = mode === 'grid' ? grid : compact

  return (
    <>
      <div class="row" style="margin-bottom:1rem">
        <Pills value={mode} onChange={setMode} options={[{ id: 'grid', label: 'Grid' }, { id: 'compact', label: 'List' }]} />
        <input class="input" style="max-width:240px" placeholder="Filter artists…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <span class="muted small">{all.length} artists</span>
      </div>
      {heads.length > 0 && <Section title="Headliners">{render(heads)}</Section>}
      {rest.length > 0 && <Section title={heads.length ? 'Undercard' : 'Lineup'}>{render(rest)}</Section>}
    </>
  )
}

// ───────── Schedule ─────────
function ScheduleTab({ fest, year }) {
  const sch = useAsync(() => getSchedule(fest.festival, year), [fest.festival, year])
  const [weekend, setWeekend] = useState(null)
  const [day, setDay] = useState(null)
  const [mode, setMode] = useState('stage')
  const [onlyTracked, setOnlyTracked] = useState(false)
  const u = useUser()

  if (sch.loading) return <Spinner />
  if (sch.error) return <ErrorBox error={sch.error} />
  const { items, cancelled, weekends, stageOrder } = sch.data
  if (!items.length && !cancelled.length) return <Empty>No schedule has been published for {year} yet.</Empty>

  const wk = weekend != null && weekends.includes(weekend) ? weekend : weekends[0]
  const inWk = (i) => i.weekend === wk
  const dayStart = new Map()
  items.concat(cancelled).filter(inWk).forEach((i) => {
    if (!dayStart.has(i.day) || i.start < dayStart.get(i.day)) dayStart.set(i.day, i.start)
  })
  const days = [...dayStart.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([d]) => d)
  const dy = day && days.includes(day) ? day : days[0]

  const weekendStart =
    fest.dates.filter((d) => Number(d.year) === year && d.weekend === wk).map((d) => d.start_dt).sort()[0] ||
    fest.dates.filter((d) => Number(d.year) === year).map((d) => d.start_dt).sort()[0]

  const trackedItem = (i) => i.names.some((n) => u.isArtistTracked(n))
  let dayItems = items.filter((i) => inWk(i) && i.day === dy).sort((a, b) => a.start.localeCompare(b.start))
  if (onlyTracked) dayItems = dayItems.filter(trackedItem)
  const dayCancelled = cancelled.filter((i) => inWk(i) && i.day === dy)

  const stages = [...new Set(dayItems.map((i) => i.stage))].sort(
    (a, b) => (stageOrder.get(a) ?? 999) - (stageOrder.get(b) ?? 999) || a.localeCompare(b)
  )
  const ctxFor = (i) => ({
    festival: fest.festival,
    year,
    festivalStart: weekendStart || null,
    festivalDate: weekendStart ? actualDate(weekendStart, i.day) : null,
  })

  return (
    <>
      <div class="row" style="margin-bottom:.9rem">
        {weekends.length > 1 && (
          <Pills value={wk} onChange={(w) => { setWeekend(w); setDay(null) }} options={weekends.map((w) => ({ id: w, label: 'Weekend ' + w }))} />
        )}
        <Pills value={dy} onChange={setDay} options={days.map((d) => ({ id: d, label: d }))} />
      </div>
      <div class="row" style="margin-bottom:1rem">
        <Pills value={mode} onChange={setMode} options={[{ id: 'stage', label: 'By stage' }, { id: 'time', label: 'By time' }]} />
        <label class="row small muted" style="gap:.35rem;cursor:pointer">
          <input type="checkbox" checked={onlyTracked} onChange={(e) => setOnlyTracked(e.currentTarget.checked)} />
          Only artists I track
        </label>
      </div>

      {dayItems.length === 0 ? <Empty>{onlyTracked ? 'None of your tracked artists play this day.' : 'Nothing scheduled.'}</Empty> : mode === 'stage' ? (
        <div class="stage-cols">
          {stages.map((s) => (
            <div class="stage-col" key={s}>
              <h3>{s}</h3>
              {dayItems.filter((i) => i.stage === s).map((i) => <SetRow key={i.key} item={i} ctx={ctxFor(i)} />)}
            </div>
          ))}
        </div>
      ) : (
        <div>{dayItems.map((i) => <SetRow key={i.key} item={i} ctx={ctxFor(i)} showStage />)}</div>
      )}

      {dayCancelled.length > 0 && (
        <Section title="Cancelled">
          {dayCancelled.map((i) => (
            <div class="set cancelled" key={i.key}>
              <div class="time">{fmtTimeRange(i.start, i.end)}</div>
              <div class="who">{i.names.join(' & ')}<div class="muted small">{i.stage}</div></div>
            </div>
          ))}
        </Section>
      )}
    </>
  )
}

function SetRow({ item, ctx, showStage }) {
  const u = useUser()
  const tracked = item.names.some((n) => u.isArtistTracked(n))
  const seen = u.isSeen(item.ids)
  return (
    <div class={'set' + (tracked ? ' tracked' : '') + (seen ? ' seen' : '')}>
      <div class="time">
        {fmtTimeRange(item.start, item.end)}
        {item.isEstimated && <div><span class="tag est">end est.</span></div>}
      </div>
      <div class="who">
        {item.names.map((n, i) => (
          <span key={n + i}>{i > 0 && ' & '}<a href={'#/artist/' + enc(n)}>{n}</a></span>
        ))}
        <div class="muted small">
          {showStage && item.stage}
          {item.slot === 'HEADLINER' && <span style="color:var(--bad);font-weight:800"> {showStage ? '· ' : ''}HEADLINER</span>}
          {item.changed && <span class="tag changed" style="margin-left:.4rem">updated</span>}
        </div>
      </div>
      <button class={'seen-btn' + (seen ? ' on' : '')} title={seen ? 'Remove from seen sets' : 'I saw this set'} onClick={() => u.toggleSeen(item, ctx)}>✓</button>
    </div>
  )
}

// ───────── Aftershows ─────────
function AftershowsTab({ fest, year }) {
  const rows = useAsync(() => getAftershows(fest.festival, year), [fest.festival, year])
  if (rows.loading) return <Spinner />
  if (rows.error) return <ErrorBox error={rows.error} />
  if (!rows.data?.length) return <Empty>No aftershows listed for {year}.</Empty>
  const groups = new Map()
  rows.data.forEach((r) => {
    const k = [r.date, r.venue_name, r.start_time].join('|')
    if (!groups.has(k)) groups.set(k, { ...r, acts: [] })
    groups.get(k).acts.push(r)
  })
  return (
    <div class="list">
      {[...groups.values()].map((g) => (
        <div class="list-item" key={[g.date, g.venue_name, g.start_time].join('|')} style="align-items:flex-start">
          <div class="time muted small" style="min-width:7.5rem">
            <div>{fmtDay(g.date)}</div>
            <div>{g.start_time ? fmtTime('T' + g.start_time) : ''}</div>
          </div>
          <div class="grow">
            <div class="title">{g.venue_name}{g.venue_city ? ` · ${g.venue_city}` : ''}</div>
            <div class="chips" style="margin-top:.35rem">
              {g.acts.map((a) => (
                <a key={a.display_name} class="chip" href={'#/artist/' + enc(a.display_name)}>{a.display_name}</a>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ───────── Poster ─────────
function PosterTab({ fest, year }) {
  const p = useAsync(() => getPoster(fest.festival, year), [fest.festival, year])
  if (p.loading) return <Spinner />
  const url = safeUrl(p.data)
  if (!url) return <Empty>No poster available for {year}.</Empty>
  return <img class="poster" src={url} alt={`${fest.festival} ${year} poster`} referrerpolicy="no-referrer" />
}

// ───────── Insights ─────────
function Insights({ fest }) {
  const top = useAsync(() => getTopArtists(fest.festival), [fest.festival])
  const cross = useAsync(() => getTopCrossovers(fest.festival), [fest.festival])
  const byYear = useMemo(() => {
    const m = new Map()
    ;(cross.data || []).forEach((r) => {
      if (!m.has(r.year)) m.set(r.year, [])
      m.get(r.year).push(r)
    })
    return [...m.entries()].sort((a, b) => b[0] - a[0]).slice(0, 5)
  }, [cross.data])
  const max = Math.max(1, ...(top.data || []).map((t) => t.appearances))
  return (
    <div class="grid two">
      <div class="card">
        <h3>Most-booked artists</h3>
        <p class="muted small">Years each artist has played {fest.festival}.</p>
        {top.loading ? <Spinner /> : top.error ? <ErrorBox error={top.error} /> : (top.data || []).map((t) => (
          <div class="bar" key={t.artist_name}>
            <a class="label" href={'#/artist/' + enc(t.artist_name)}>{t.artist_name}</a>
            <div class="track"><div class="fill" style={{ width: (t.appearances / max) * 100 + '%' }} /></div>
            <div class="val">{t.appearances}×</div>
          </div>
        ))}
      </div>
      <div class="card">
        <h3>Festivals with the most shared artists</h3>
        <p class="muted small">Artists who played both in the same year.</p>
        {cross.loading ? <Spinner /> : cross.error ? <ErrorBox error={cross.error} /> : byYear.map(([y, rows]) => (
          <div key={y} style="margin-bottom:.8rem">
            <strong>{y}</strong>
            <div class="chips" style="margin-top:.3rem">
              {rows.slice(0, 5).map((r) => (
                <a key={r.festival} class="chip" href={`#/compare?a=${enc(fest.festival)}&b=${enc(r.festival)}`}>
                  {r.festival} · {r.shared_count}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
