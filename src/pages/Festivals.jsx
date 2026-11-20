import { useMemo, useState } from 'preact/hooks'
import { useAsync } from '../hooks.js'
import { getFestivalIndex } from '../api.js'
import { Spinner, ErrorBox, FestCard, Pills, Empty } from '../components/ui.jsx'
import { fmtMonthYear } from '../util.js'
import { useUser } from '../userdata.jsx'

export default function Festivals() {
  const idx = useAsync(getFestivalIndex, [])
  const u = useUser()
  const [q, setQ] = useState('')
  const [view, setView] = useState('grid')
  const [filter, setFilter] = useState('all')

  const list = useMemo(() => {
    let l = idx.data?.festivals || []
    if (q.trim()) l = l.filter((f) => f.festival.toLowerCase().includes(q.trim().toLowerCase()))
    if (filter === 'upcoming') l = l.filter((f) => f.next)
    if (filter === 'tracked') l = l.filter((f) => u.isFestivalTracked(f.festival))
    return l
  }, [idx.data, q, filter, u.festivals])

  const months = useMemo(() => {
    const m = new Map()
    list.filter((f) => f.next).sort((a, b) => a.next.start.localeCompare(b.next.start)).forEach((f) => {
      const k = fmtMonthYear(f.next.start)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(f)
    })
    return [...m.entries()]
  }, [list])

  return (
    <>
      <div class="row" style="justify-content:space-between">
        <h1>Festivals</h1>
        <input class="input" style="max-width:260px" placeholder="Search festivals…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </div>
      <div class="row" style="margin:1rem 0">
        <Pills
          value={view}
          onChange={setView}
          options={[{ id: 'grid', label: 'All' }, { id: 'calendar', label: 'Calendar' }]}
        />
        <Pills
          value={filter}
          onChange={setFilter}
          options={[{ id: 'all', label: 'Any' }, { id: 'upcoming', label: 'With upcoming dates' }, { id: 'tracked', label: 'Tracked' }]}
        />
      </div>
      {idx.loading ? <Spinner /> : idx.error ? <ErrorBox error={idx.error} /> : list.length === 0 ? (
        <Empty>No festivals match.</Empty>
      ) : view === 'grid' ? (
        <div class="grid fest">{list.map((f) => <FestCard key={f.key} fest={f} />)}</div>
      ) : (
        months.length === 0 ? <Empty>No upcoming dates yet.</Empty> : months.map(([month, fs]) => (
          <div class="cal-month" key={month}>
            <h3>{month}</h3>
            <div class="grid fest">{fs.map((f) => <FestCard key={f.key} fest={f} />)}</div>
          </div>
        ))
      )}
    </>
  )
}
