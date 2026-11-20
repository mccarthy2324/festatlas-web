import { useMemo, useState } from 'preact/hooks'
import { useAsync } from '../hooks.js'
import { getFestivalIndex, getCrossover, getNormalization, displayName } from '../api.js'
import { Spinner, ErrorBox, Empty, Section } from '../components/ui.jsx'
import { enc } from '../router.js'

export default function Crossover({ params }) {
  const idx = useAsync(getFestivalIndex, [])
  const [a, setA] = useState(params.a || '')
  const [b, setB] = useState(params.b || '')
  const ready = a && b && a !== b
  const data = useAsync(
    () => (ready ? Promise.all([getCrossover(a, b), getNormalization().catch(() => new Map())]) : Promise.resolve(null)),
    [a, b]
  )
  const names = useMemo(() => (idx.data?.festivals || []).map((f) => f.festival), [idx.data])

  const byYear = useMemo(() => {
    if (!data.data) return []
    const [rows, norm] = data.data
    const m = new Map()
    rows.forEach((r) => {
      if (!m.has(r.year)) m.set(r.year, new Set())
      m.get(r.year).add(displayName(norm, r.artist_name))
    })
    return [...m.entries()].sort((x, y) => y[0] - x[0]).map(([y, s]) => [y, [...s].sort()])
  }, [data.data])

  const pick = (set, v) => {
    set(v)
    history.replaceState(null, '', '#/compare')
  }

  return (
    <>
      <h1>Compare festivals</h1>
      <p class="muted">See which artists played both festivals in the same year.</p>
      <div class="row" style="margin:1rem 0">
        <select class="input" value={a} onChange={(e) => pick(setA, e.currentTarget.value)}>
          <option value="">Festival A…</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span class="muted">vs</span>
        <select class="input" value={b} onChange={(e) => pick(setB, e.currentTarget.value)}>
          <option value="">Festival B…</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {!ready ? <Empty>Pick two different festivals.</Empty> : data.loading ? <Spinner /> : data.error ? <ErrorBox error={data.error} /> : byYear.length === 0 ? (
        <Empty>No shared artists found between {a} and {b}.</Empty>
      ) : byYear.map(([year, artists]) => (
        <Section key={year} title={`${year} · ${artists.length} shared`}>
          <div class="chips">
            {artists.map((n) => <a key={n} class="chip" href={'#/artist/' + enc(n)}>{n}</a>)}
          </div>
        </Section>
      ))}
    </>
  )
}
