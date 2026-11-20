// All reads and writes go through here. Every table, view and RPC name below is
// the same one the iOS app calls, so the web app sees exactly the same data and
// is bound by exactly the same Row Level Security rules.
import { supabase } from './supabase.js'
import { todayStr, titleCase } from './util.js'

const PAGE = 1000 // PostgREST's default max rows per request
const cache = new Map()

function memo(key, fn) {
  if (!cache.has(key)) {
    cache.set(key, fn().catch((e) => { cache.delete(key); throw e }))
  }
  return cache.get(key)
}

export function unwrap(res) {
  if (res.error) throw res.error
  return res.data
}

async function fetchAll(build) {
  let out = []
  for (let from = 0; ; from += PAGE) {
    const data = unwrap(await build(from, from + PAGE - 1))
    out = out.concat(data || [])
    if (!data || data.length < PAGE) break
  }
  return out
}

const rpc = (fn, args) => supabase.rpc(fn, args).then(unwrap)

// ───────────────────────── Festivals ─────────────────────────

export const getFestivalIndex = () =>
  memo('festival-index', async () => {
    const [info, logos, dates] = await Promise.all([
      fetchAll((a, b) => supabase.from('festival_information').select('*').order('festival').range(a, b)),
      fetchAll((a, b) =>
        supabase.from('festival_logos').select('festival_name,logo_url').order('festival_name').range(a, b)
      ).catch(() => []),
      fetchAll((a, b) =>
        supabase
          .from('festival_dates')
          .select('festival,year,start_dt,end_dt,tag,weekend')
          .order('festival')
          .order('year')
          .order('weekend')
          .range(a, b)
      ),
    ])

    const logoMap = new Map(logos.map((l) => [String(l.festival_name).toLowerCase(), l.logo_url]))
    const datesBy = new Map()
    for (const d of dates) {
      const k = String(d.festival || '').toLowerCase()
      if (!datesBy.has(k)) datesBy.set(k, [])
      datesBy.get(k).push(d)
    }

    const today = todayStr()
    const festivals = info.map((f) => {
      const key = f.festival.toLowerCase()
      const valid = (datesBy.get(key) || []).filter(
        (d) => (d.tag || '').toUpperCase() !== 'CANCELLED' && /^\d+$/.test(String(d.year)) && d.start_dt
      )
      const upcoming = valid.filter((d) => d.end_dt && d.end_dt >= today)
      let next = null
      if (upcoming.length) {
        const yr = Math.min(...upcoming.map((d) => Number(d.year)))
        const inYr = upcoming.filter((d) => Number(d.year) === yr)
        const start = inYr.map((d) => d.start_dt).sort()[0]
        const end = inYr.map((d) => d.end_dt).sort().slice(-1)[0]
        next = { year: yr, start, end, isNow: start <= today && end >= today }
      }
      const years = [...new Set(valid.map((d) => Number(d.year)))].sort((a, b) => b - a)
      const bannerpath = /^https?:\/\//i.test(f.bannerpath || '') ? f.bannerpath : null
      return { ...f, key, logo: logoMap.get(key) || null, banner: bannerpath, dates: valid, next, years }
    })
    return { festivals, byKey: new Map(festivals.map((f) => [f.key, f])) }
  })

export const getLineupYears = (festival) =>
  memo(`lineup-years:${festival}`, async () => {
    const rows = await rpc('get_lineup_counts', { fest: festival })
    return (rows || [])
      .map((r) => ({ year: Number(r.year), count: r.artist_count }))
      .sort((a, b) => b.year - a.year)
  })

export const getLineup = (festival, year) =>
  fetchAll((a, b) =>
    supabase
      .from('festival_lineup_artists_view')
      .select('*')
      .eq('festival', festival)
      .eq('year', year)
      .order('is_headliner', { ascending: false })
      .order('billing_rank')
      .order('artist_name')
      .range(a, b)
  )

export const getPoster = async (festival, year) => {
  const rows = unwrap(
    await supabase.from('festival_posters').select('poster_url').eq('festival', festival).eq('year', year).limit(1)
  )
  return rows?.[0]?.poster_url || null
}

export const getAftershows = (festival, year) =>
  rpc('aftershows_for_festival_year', { p_festival: festival, p_year: year })

export const getTopArtists = (festival) => rpc('top_artists_by_festival', { festival_name: festival })

export const getTopCrossovers = (festival) => rpc('get_top_crossovers_by_year', { fest: festival })

export const getCrossover = (a, b) => rpc('get_festival_crossover', { fest1: a, fest2: b })

// Name normalisation (RAW UPPERCASE -> proper name)
export const getNormalization = () =>
  memo('normalization', async () => {
    const rows = await fetchAll((a, b) =>
      supabase.from('artist_name_normalization').select('artist_name,proper_name').order('artist_name').range(a, b)
    )
    return new Map(rows.map((r) => [String(r.artist_name).toUpperCase(), r.proper_name]))
  })

export function displayName(norm, raw) {
  return norm?.get(String(raw || '').toUpperCase()) || titleCase(raw)
}

// ───────────────────────── Schedule ─────────────────────────

export async function getSchedule(festival, year) {
  const q = (view) =>
    fetchAll((a, b) =>
      supabase.from(view).select('*').eq('festival', festival).eq('year', String(year)).order('row_num').range(a, b)
    )
  const [original, updated, stageRows, norm] = await Promise.all([
    q('festival_schedule_view'),
    q('festival_schedule_updated_view'),
    supabase
      .from('festival_schedule_stage_order')
      .select('stage_name,stage_order')
      .eq('festival', festival)
      .eq('year', String(year))
      .then((r) => r.data || []),
    getNormalization().catch(() => new Map()),
  ])
  const stageOrder = new Map(stageRows.map((r) => [r.stage_name, r.stage_order]))
  return buildSchedule(original, updated, stageOrder, norm)
}

function groupRows(rows, norm) {
  const groups = new Map()
  for (const r of rows) {
    const key = [r.start_time, r.effective_end_time || '', r.stage_name || '', r.day_name, r.weekend].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  return [...groups.entries()].map(([key, rs]) => {
    const f = rs[0]
    return {
      key,
      start: f.start_time,
      end: f.effective_end_time,
      isEstimated: !!f.is_estimated,
      stage: f.stage_name || 'Unknown',
      day: f.day_name,
      weekend: f.weekend,
      slot: f.slot,
      tag: f.tag,
      rawSetTime: f.rawsettime,
      ids: rs.map((r) => r.row_num),
      rawNames: rs.map((r) => r.artist_name),
      names: rs.map((r) => displayName(norm, r.artist_name)),
    }
  })
}

function buildSchedule(original, updated, stageOrder, norm) {
  const origById = new Map(original.map((r) => [r.row_num, r]))
  const updIds = new Set(updated.map((r) => r.row_num))
  const items = groupRows(updated, norm).map((it) => {
    const changed = it.ids.some((id) => {
      const o = origById.get(id)
      return o && (o.start_time !== it.start || (o.stage_name || '') !== (it.stage === 'Unknown' ? '' : it.stage))
    })
    return { ...it, changed }
  })
  const cancelled = groupRows(
    original.filter((r) => !updIds.has(r.row_num)),
    norm
  )
  const weekends = [...new Set(items.concat(cancelled).map((i) => i.weekend))].sort((a, b) => a - b)
  return { items, cancelled, weekends, stageOrder }
}

// Real start/end times for specific set ids (used on artist pages)
export async function getSetTimes(ids) {
  const out = new Map()
  const chunks = []
  for (let i = 0; i < ids.length; i += 80) chunks.push(ids.slice(i, i + 80))
  const results = await Promise.all(
    chunks.map((c) =>
      supabase
        .from('festival_schedule_updated_view')
        .select('row_num,start_time,effective_end_time,stage_name,is_estimated')
        .in('row_num', c)
        .then((r) => r.data || [])
    )
  )
  for (const r of results.flat()) out.set(r.row_num, r)
  return out
}

// ───────────────────────── News ─────────────────────────

export const getNews = () =>
  memo('news', () =>
    fetchAll((a, b) =>
      supabase
        .from('festival_news')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .order('id')
        .range(a, b)
    )
  )

// ───────────────────────── Artists ─────────────────────────

export const getHotArtists = (scope = 'yearly') =>
  memo(`hot:${scope}`, async () =>
    unwrap(await supabase.from('hot_artists_mv').select('*').eq('scope', scope).order('rank').limit(15))
  )

export const searchArtists = (query, lim = 30) => rpc('search_artists_fast', { query, lim })

export async function getArtistMeta(name) {
  let rows = unwrap(
    await supabase.from('artist_metadata').select('*').eq('normalized_name', name.toLowerCase()).limit(1)
  )
  if (!rows?.length) {
    rows = unwrap(
      await supabase
        .from('artist_metadata')
        .select('*')
        .ilike('artist_name', name.replace(/[\\%_]/g, (c) => '\\' + c))
        .limit(1)
    )
  }
  return rows?.[0] || null
}

export const getArtistAppearances = (name) => rpc('artist_festival_appearances2', { p_artist_name: name })
export const getArtistCounts = (name) => rpc('artist_festival_counts', { artist: name })
export const getArtistAlongside = (name) => rpc('artists_played_alongside', { p_artist_name: name, p_limit: 12 })
export const getArtistFamily = (name) => rpc('artist_family', { p_artist_name: name })
export const getArtistAftershows = (name) => rpc('artist_aftershow_appearances', { p_artist_name: name })
export const getArtistEvents = async (metaId) =>
  unwrap(
    await supabase
      .from('artist_events')
      .select('event_date,event_time,venue_name,venue_city,venue_country,ticket_url')
      .eq('artist_metadata_id', metaId)
      .gte('event_date', todayStr())
      .order('event_date')
      .limit(20)
  )

// ───────────────────────── Signed-in data ─────────────────────────

export const getTrackedArtistNames = (uid) =>
  fetchAll((a, b) =>
    supabase.from('user_tracked_artists').select('artist_name').eq('user_id', uid).order('artist_name').range(a, b)
  )

export const getTrackedFestivalNames = (uid) =>
  fetchAll((a, b) =>
    supabase.from('user_tracked_festivals').select('festival_name').eq('user_id', uid).order('festival_name').range(a, b)
  )

export const getTrackedArtistsEnriched = (uid) =>
  fetchAll((a, b) =>
    supabase.from('user_tracked_artists_enriched').select('*').eq('user_id', uid).order('artist_name').range(a, b)
  )

export const getMyGoing = () => rpc('my_going')
export const goingSet = (festival, year, weekends) =>
  rpc('going_set', { p_festival: festival, p_year: year, p_weekends: weekends })
export const goingClear = (festival, year) => rpc('going_clear', { p_festival: festival, p_year: year })

export const getSeenSets = (uid) => rpc('user_seen_sets_with_start_dates', { p_user_id: uid })
export const getHabits = async () => (await rpc('get_festival_habits'))?.[0] || null
export const getDNA = () => rpc('get_festival_dna_v2', { p_use_ratings: true })
export const getRecommendations = () => rpc('atlas_recommendations', { p_today: todayStr() })
export const getPlayingSoon = () => rpc('atlas_playing_soon', { p_today: todayStr() })
export const getPastEditions = () => rpc('atlas_past_editions', { p_today: todayStr() })
export const getPastLineup = (festival, year, weekend) =>
  rpc('atlas_past_lineup', { p_festival: festival, p_year: year, p_weekend: weekend ?? null })

export const getProfile = async (uid) =>
  unwrap(await supabase.from('user_profiles').select('*').eq('user_id', uid).limit(1))?.[0] || null

export const handleAvailable = (h) => rpc('handle_available', { p_handle: h })

export async function saveProfile(uid, { display_name, handle, bio, location, is_public }) {
  const row = { user_id: uid, display_name, handle, bio, location, is_public }
  unwrap(await supabase.from('user_profiles').upsert(row, { onConflict: 'user_id' }))
}
