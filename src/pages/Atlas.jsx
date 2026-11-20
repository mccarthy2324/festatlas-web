import { useMemo, useState } from 'preact/hooks'
import { useAsync } from '../hooks.js'
import { useAuth } from '../auth.jsx'
import { useUser } from '../userdata.jsx'
import {
  getFestivalIndex, getHabits, getPlayingSoon, getRecommendations, getTrackedArtistsEnriched,
  getDNA, getPastEditions, getPastLineup, getNormalization, displayName,
} from '../api.js'
import { Spinner, ErrorBox, Empty, Tabs, Section, FestCard, Link, TrackStar, Pills } from '../components/ui.jsx'
import { enc } from '../router.js'
import { fmtRange, fmtDay, fmtShort, actualDate } from '../util.js'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'artists', label: 'Artists' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'seen', label: 'Seen sets' },
  { id: 'dna', label: 'Festival DNA' },
]

export default function Atlas({ params }) {
  const { user, ready } = useAuth()
  const [tab, setTab] = useState(TABS.some((t) => t.id === params.tab) ? params.tab : 'overview')
  if (!ready) return <Spinner />
  if (!user) {
    return (
      <div class="hero">
        <h1>Your festival Atlas</h1>
        <p>Sign in to track artists and festivals, see who’s playing soon, log the sets you’ve seen and discover your Festival DNA.</p>
        <Link to="/login?next=%2Fatlas" class="btn primary">Sign in or create an account</Link>
      </div>
    )
  }
  return (
    <>
      <h1>My Atlas</h1>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'overview' && <Overview />}
      {tab === 'artists' && <ArtistsTab user={user} />}
      {tab === 'festivals' && <FestivalsTab />}
      {tab === 'seen' && <SeenTab />}
      {tab === 'dna' && <DnaTab />}
    </>
  )
}

// ───────── Overview ─────────
function Overview() {
  const u = useUser()
  const habits = useAsync(getHabits, [])
  const soon = useAsync(getPlayingSoon, [])
  const recs = useAsync(getRecommendations, [])
  const idx = useAsync(getFestivalIndex, [])
  const h = habits.data

  const upcomingGoing = u.going.filter((g) => !g.is_past)
  return (
    <>
      <div class="grid stats">
        <div class="stat"><b>{u.artists.size}</b><span class="muted small">artists tracked</span></div>
        <div class="stat"><b>{u.festivals.size}</b><span class="muted small">festivals tracked</span></div>
        <div class="stat"><b>{u.seenRows.length}</b><span class="muted small">sets seen</span></div>
        <div class="stat"><b>{h?.total_trips ?? '–'}</b><span class="muted small">festival trips</span></div>
        {h?.top_festival && <div class="stat"><b style="font-size:1.1rem">{h.top_festival}</b><span class="muted small">most-visited ({h.top_festival_years} yrs)</span></div>}
        {h?.top_artist && <div class="stat"><b style="font-size:1.1rem">{h.top_artist}</b><span class="muted small">most-seen ({h.top_artist_times}×)</span></div>}
      </div>

      {upcomingGoing.length > 0 && (
        <Section title="You’re going to">
          <div class="list">
            {upcomingGoing.map((g) => (
              <a class="list-item" key={g.festival + g.year + g.weekend} href={`#/festival/${enc(g.festival)}?year=${g.year}`}>
                <div class="grow">
                  <div class="title">{g.festival} {g.year}{g.weekend_count > 1 && g.weekend > 0 ? ` · Weekend ${g.weekend}` : ''}</div>
                  <div class="muted small">{fmtRange(g.start_dt, g.end_dt)}</div>
                </div>
              </a>
            ))}
          </div>
        </Section>
      )}

      <Section title="Your artists playing soon">
        {soon.loading ? <Spinner /> : soon.error ? <ErrorBox error={soon.error} /> : (soon.data || []).length === 0 ? (
          <Empty>Track some artists and their upcoming festival sets will show up here.</Empty>
        ) : (
          <div class="list">
            {soon.data.slice(0, 20).map((r) => (
              <a class="list-item" key={r.artist_name + r.festival + r.year} href={`#/festival/${enc(r.festival)}?year=${r.year}`}>
                <div class="grow">
                  <div class="title">{r.artist_name}</div>
                  <div class="muted small">{r.festival} {r.year} · {fmtRange(r.start_dt, r.end_dt)}</div>
                </div>
                {r.slot === 'HEADLINER' && <span class="badge">HEADLINER</span>}
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title="Festivals you might like">
        {recs.loading || idx.loading ? <Spinner /> : recs.error ? <ErrorBox error={recs.error} /> : (recs.data || []).length === 0 ? (
          <Empty>Nothing yet. Track a few artists to get suggestions.</Empty>
        ) : (
          <div class="grid fest">
            {recs.data.map((r) => {
              const f = idx.data?.byKey.get(r.festival.toLowerCase())
              return (
                <div key={r.festival + r.year}>
                  {f ? <FestCard fest={f} /> : <div class="card">{r.festival}</div>}
                  <div class="muted small" style="margin:.35rem .3rem 0">
                    {r.artist_count} of your artists: {(r.artists || []).slice(0, 4).join(', ')}{(r.artists || []).length > 4 ? '…' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}

// ───────── Artists ─────────
function ArtistsTab({ user }) {
  const u = useUser()
  const rows = useAsync(() => getTrackedArtistsEnriched(user.id), [user.id, u.artists.size])
  const [q, setQ] = useState('')
  const list = (rows.data || []).filter((r) => !q.trim() || r.artist_name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <>
      <div class="row" style="margin-bottom:1rem">
        <input class="input" style="max-width:280px" placeholder="Filter tracked artists…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <span class="muted small">{(rows.data || []).length} tracked</span>
        <Link to="/search" class="btn small">Find artists</Link>
      </div>
      {rows.loading && !rows.data ? <Spinner /> : rows.error ? <ErrorBox error={rows.error} /> : list.length === 0 ? (
        <Empty>No tracked artists yet. Open any artist and tap the ☆.</Empty>
      ) : (
        <div class="list">
          {list.map((r) => (
            <div class="list-item" key={r.artist_name}>
              <TrackStar name={r.artist_name} />
              <div class="grow">
                <a class="title" href={'#/artist/' + enc(r.artist_name)}>{r.artist_name}</a>
                <div class="muted small">
                  Next: {r.next_festival}{r.last_festival ? ` · Last: ${r.last_festival}` : ''}
                </div>
              </div>
              {r.upcoming_festivals_count > 0 && <span class="tag soon">{r.upcoming_festivals_count} upcoming</span>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ───────── Festivals ─────────
function FestivalsTab() {
  const u = useUser()
  const idx = useAsync(getFestivalIndex, [])
  if (idx.loading) return <Spinner />
  if (idx.error) return <ErrorBox error={idx.error} />
  const tracked = idx.data.festivals.filter((f) => u.isFestivalTracked(f.festival)).sort((a, b) => (a.next?.start || '9').localeCompare(b.next?.start || '9'))
  const upcoming = u.going.filter((g) => !g.is_past)
  const past = u.going.filter((g) => g.is_past)
  const row = (g) => (
    <div class="list-item" key={g.festival + g.year + g.weekend}>
      <div class="grow">
        <a class="title" href={`#/festival/${enc(g.festival)}?year=${g.year}`}>{g.festival} {g.year}{g.weekend_count > 1 && g.weekend > 0 ? ` · Weekend ${g.weekend}` : ''}</a>
        <div class="muted small">{fmtRange(g.start_dt, g.end_dt) || 'Dates TBA'}{g.has_sets ? ' · sets logged' : ''}</div>
      </div>
      {g.has_plan && !g.is_past && <button class="btn small" onClick={() => u.clearGoing(g.festival, g.year)}>Not going</button>}
    </div>
  )
  return (
    <>
      <Section title="Going">{upcoming.length ? <div class="list">{upcoming.map(row)}</div> : <Empty>You haven’t marked any upcoming festivals as “I’m going”.</Empty>}</Section>
      <Section title="Tracking">
        {tracked.length ? <div class="grid fest">{tracked.map((f) => <FestCard key={f.key} fest={f} />)}</div> : <Empty>No tracked festivals yet.</Empty>}
      </Section>
      {past.length > 0 && <Section title="Festivals you’ve been to"><div class="list">{past.map(row)}</div></Section>}
    </>
  )
}

// ───────── Seen sets ─────────
function SeenTab() {
  const u = useUser()
  const [logging, setLogging] = useState(false)
  const groups = useMemo(() => {
    const m = new Map()
    u.seenRows.forEach((r) => {
      const k = `${r.festival}|${r.year}|${r.weekend ?? 0}`
      if (!m.has(k)) m.set(k, { festival: r.festival, year: r.year, weekend: r.weekend, start: r.festival_start_date, rows: [] })
      m.get(k).rows.push(r)
    })
    return [...m.values()].sort((a, b) => b.year - a.year || (b.start || '').localeCompare(a.start || '') || a.festival.localeCompare(b.festival))
  }, [u.seenRows])

  return (
    <>
      <div class="row" style="margin-bottom:1rem;justify-content:space-between">
        <span class="muted">{u.seenRows.length} sets across {groups.length} festival{groups.length === 1 ? '' : 's'}</span>
        <button class="btn primary" onClick={() => setLogging(!logging)}>{logging ? 'Close' : '+ Log a past festival'}</button>
      </div>
      {logging && <PastLogger />}
      {groups.length === 0 ? <Empty>No sets logged yet. Tap ✓ on any schedule, or log a past festival.</Empty> : groups.map((g) => (
        <Section key={g.festival + g.year + g.weekend} title={`${g.festival} ${g.year}${g.weekend > 0 ? ` · W${g.weekend}` : ''}`}>
          <div class="list">
            {g.rows
              .slice()
              .sort((a, b) => (a.festival_date || '').localeCompare(b.festival_date || '') || (a.set_time || '').localeCompare(b.set_time || ''))
              .map((r) => (
                <div class="list-item" key={r.id}>
                  <div class="grow">
                    <a class="title" href={'#/artist/' + enc(r.artist_name)}>{r.artist_name}</a>
                    <div class="muted small">{[r.festival_date && fmtDay(r.festival_date), r.stage_name].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button class="btn small danger" onClick={() => u.removeSeenRow(r)}>Remove</button>
                </div>
              ))}
          </div>
        </Section>
      ))}
    </>
  )
}

function PastLogger() {
  const u = useUser()
  const editions = useAsync(getPastEditions, [])
  const norm = useAsync(() => getNormalization().catch(() => new Map()), [])
  const [fest, setFest] = useState('')
  const [edKey, setEdKey] = useState('')

  const festivals = useMemo(() => [...new Set((editions.data || []).map((e) => e.festival))].sort((a, b) => a.localeCompare(b)), [editions.data])
  const eds = useMemo(() => (editions.data || []).filter((e) => e.festival === fest), [editions.data, fest])
  const ed = eds.find((e) => `${e.year}|${e.weekend}` === edKey)
  const lineup = useAsync(() => (ed ? getPastLineup(ed.festival, ed.year, ed.weekend) : Promise.resolve([])), [edKey, fest])

  if (editions.loading) return <Spinner />
  if (editions.error) return <ErrorBox error={editions.error} />

  const days = [...new Set((lineup.data || []).map((l) => l.day_name))]
  return (
    <div class="card" style="margin-bottom:1.5rem">
      <div class="row">
        <select class="input" value={fest} onChange={(e) => { setFest(e.currentTarget.value); setEdKey('') }}>
          <option value="">Festival…</option>
          {festivals.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        {fest && (
          <select class="input" value={edKey} onChange={(e) => setEdKey(e.currentTarget.value)}>
            <option value="">Edition…</option>
            {eds.map((e) => (
              <option key={e.year + '|' + e.weekend} value={`${e.year}|${e.weekend}`}>
                {e.year}{eds.filter((x) => x.year === e.year).length > 1 ? ` · Weekend ${e.weekend}` : ''} ({fmtShort(e.start_dt)})
              </option>
            ))}
          </select>
        )}
      </div>
      {ed && (lineup.loading ? <Spinner /> : lineup.error ? <ErrorBox error={lineup.error} /> : (
        <div style="margin-top:1rem">
          {days.map((d) => (
            <div key={d}>
              <h3 style="margin:1rem 0 .4rem">{d || 'Lineup'}</h3>
              <div class="chips">
                {lineup.data.filter((l) => l.day_name === d).map((l) => {
                  const seen = u.isSeen([l.appearance_id])
                  const item = {
                    ids: [l.appearance_id], rawNames: [l.raw_name], day: l.day_name, stage: l.stage_name || 'Unknown',
                    rawSetTime: l.set_time, slot: l.slot, tag: l.tag, weekend: l.weekend,
                  }
                  const ctx = {
                    festival: ed.festival, year: ed.year, festivalStart: ed.start_dt,
                    festivalDate: l.day_name ? actualDate(ed.start_dt, l.day_name) : null,
                  }
                  return (
                    <button key={l.appearance_id} class={'pill' + (seen ? ' on' : '')} onClick={() => u.toggleSeen(item, ctx)}>
                      {seen ? '✓ ' : ''}{displayName(norm.data, l.raw_name)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ───────── DNA ─────────
function DnaTab() {
  const dna = useAsync(getDNA, [])
  if (dna.loading) return <Spinner />
  if (dna.error) return <ErrorBox error={dna.error} />
  const rows = dna.data || []
  const genres = rows.filter((r) => r.kind === 'genre')
  const families = rows.filter((r) => r.kind === 'family')
  const cov = rows.find((r) => r.kind === 'coverage')
  if (!genres.length && !families.length) return <Empty>Log some seen sets and your Festival DNA will appear here.</Empty>
  const bars = (list) => {
    const max = Math.max(1, ...list.map((r) => Number(r.percentage) || 0))
    return list.map((r) => (
      <div class="bar" key={r.label}>
        <div class="label">{r.label}</div>
        <div class="track"><div class="fill" style={{ width: ((Number(r.percentage) || 0) / max) * 100 + '%' }} /></div>
        <div class="val">{Number(r.percentage).toFixed(1)}%</div>
      </div>
    ))
  }
  return (
    <>
      <div class="grid two">
        <div class="card"><h3>Genre families</h3><div style="margin-top:.6rem">{bars(families)}</div></div>
        <div class="card"><h3>Top genres</h3><div style="margin-top:.6rem">{bars(genres)}</div></div>
      </div>
      {cov && (
        <p class="muted small" style="margin-top:1rem">
          Based on {cov.artist_count} of {cov.times_seen} artists you’ve seen that have genre data.
        </p>
      )}
    </>
  )
}
