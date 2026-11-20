import { createContext } from 'preact'
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks'
import { supabase } from './supabase.js'
import { useAuth } from './auth.jsx'
import { go } from './router.js'
import { toast } from './hooks.js'
import { escapeLike } from './util.js'
import {
  getTrackedArtistNames,
  getTrackedFestivalNames,
  getSeenSets,
  getMyGoing,
  goingSet,
  goingClear,
} from './api.js'

const Ctx = createContext(null)
export const useUser = () => useContext(Ctx)

const lc = (s) => String(s || '').toLowerCase()

export function requireLogin() {
  go('/login?next=' + encodeURIComponent(location.hash.replace(/^#/, '') || '/'))
}

export function UserDataProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.id || null
  const [artists, setArtists] = useState(new Set())
  const [festivals, setFestivals] = useState(new Set())
  const [seenIds, setSeenIds] = useState(new Set())
  const [seenRows, setSeenRows] = useState([])
  const [going, setGoing] = useState([])
  const [loaded, setLoaded] = useState(false)
  const seenRef = useRef(seenIds)
  seenRef.current = seenIds

  const reloadSeen = useCallback(async () => {
    if (!uid) return
    const rows = await getSeenSets(uid)
    setSeenRows(rows || [])
    setSeenIds(new Set((rows || []).map((r) => r.appearance_id).filter((x) => x != null)))
  }, [uid])

  const reloadGoing = useCallback(async () => {
    if (!uid) return
    setGoing((await getMyGoing()) || [])
  }, [uid])

  const reload = useCallback(async () => {
    if (!uid) {
      setArtists(new Set()); setFestivals(new Set()); setSeenIds(new Set()); setSeenRows([]); setGoing([]); setLoaded(false)
      return
    }
    const [a, f, s, g] = await Promise.allSettled([
      getTrackedArtistNames(uid),
      getTrackedFestivalNames(uid),
      getSeenSets(uid),
      getMyGoing(),
    ])
    if (a.status === 'fulfilled') setArtists(new Set(a.value.map((r) => lc(r.artist_name))))
    if (f.status === 'fulfilled') setFestivals(new Set(f.value.map((r) => lc(r.festival_name))))
    if (s.status === 'fulfilled') {
      setSeenRows(s.value || [])
      setSeenIds(new Set((s.value || []).map((r) => r.appearance_id).filter((x) => x != null)))
    }
    if (g.status === 'fulfilled') setGoing(g.value || [])
    setLoaded(true)
  }, [uid])

  useEffect(() => { reload() }, [reload])

  const flip = (setter, key, on) =>
    setter((s) => {
      const n = new Set(s)
      on ? n.delete(key) : n.add(key)
      return n
    })

  async function toggleArtist(name) {
    if (!uid) return requireLogin()
    const k = lc(name)
    const on = artists.has(k)
    flip(setArtists, k, on)
    try {
      if (on) {
        const { error } = await supabase.from('user_tracked_artists').delete().eq('user_id', uid).ilike('artist_name', escapeLike(name))
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_tracked_artists').insert({ user_id: uid, artist_name: name })
        if (error && error.code !== '23505') throw error
      }
    } catch (e) {
      flip(setArtists, k, !on)
      toast(e.message || 'Could not update tracked artists')
    }
  }

  async function toggleFestival(name) {
    if (!uid) return requireLogin()
    const k = lc(name)
    const on = festivals.has(k)
    flip(setFestivals, k, on)
    try {
      if (on) {
        const { error } = await supabase.from('user_tracked_festivals').delete().eq('user_id', uid).ilike('festival_name', escapeLike(name))
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_tracked_festivals').insert({ user_id: uid, festival_name: name })
        if (error && error.code !== '23505') throw error
      }
    } catch (e) {
      flip(setFestivals, k, !on)
      toast(e.message || 'Could not update tracked festivals')
    }
  }

  // `item` comes from the schedule: ids[], rawNames[], day, stage, rawSetTime, slot, tag, weekend
  // `ctx`: { festival, year, festivalDate, festivalStart }
  async function toggleSeen(item, ctx) {
    if (!uid) return requireLogin()
    const current = seenRef.current
    const already = item.ids.some((id) => current.has(id))
    try {
      if (already) {
        setSeenIds((s) => {
          const n = new Set(s)
          item.ids.forEach((id) => n.delete(id))
          return n
        })
        const { error } = await supabase.from('user_seen_sets').delete().eq('user_id', uid).in('appearance_id', item.ids)
        if (error) throw error
      } else {
        setSeenIds((s) => new Set([...s, ...item.ids]))
        const rows = item.ids.map((id, i) => ({
          user_id: uid,
          artist_name: item.rawNames[i],
          festival: ctx.festival,
          year: ctx.year,
          festival_date: ctx.festivalDate || null,
          day_of_week: item.day || null,
          stage_name: item.stage === 'Unknown' ? null : item.stage,
          set_time: item.rawSetTime || null,
          slot: item.slot || null,
          tag: item.tag || null,
          weekend: item.weekend ?? null,
          festival_start_date: ctx.festivalStart || null,
          appearance_id: id,
        }))
        const { error } = await supabase.from('user_seen_sets').insert(rows)
        if (error && error.code !== '23505') throw error
      }
      reloadSeen().catch(() => {})
    } catch (e) {
      toast(e.message || 'Could not update seen sets')
      reloadSeen().catch(() => {})
    }
  }

  async function removeSeenRow(row) {
    try {
      const { error } = await supabase.from('user_seen_sets').delete().eq('id', row.id)
      if (error) throw error
      await reloadSeen()
    } catch (e) {
      toast(e.message || 'Could not remove set')
    }
  }

  async function setGoingFor(festival, year, weekends) {
    if (!uid) return requireLogin()
    try {
      await goingSet(festival, year, weekends)
      await Promise.all([reloadGoing(), reload()])
    } catch (e) {
      toast(e.message || 'Could not update plans')
    }
  }

  async function clearGoing(festival, year) {
    try {
      await goingClear(festival, year)
      await reloadGoing()
    } catch (e) {
      toast(e.message || 'Could not update plans')
    }
  }

  const value = {
    loaded,
    artists,
    festivals,
    seenIds,
    seenRows,
    going,
    isArtistTracked: (n) => artists.has(lc(n)),
    isFestivalTracked: (n) => festivals.has(lc(n)),
    isSeen: (ids) => ids.some((id) => seenIds.has(id)),
    goingFor: (festival, year) => going.filter((g) => lc(g.festival) === lc(festival) && g.year === year),
    toggleArtist,
    toggleFestival,
    toggleSeen,
    removeSeenRow,
    setGoingFor,
    clearGoing,
    reload,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
