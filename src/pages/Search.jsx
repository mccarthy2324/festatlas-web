import { useEffect, useState } from 'preact/hooks'
import { useAsync, useDebounced } from '../hooks.js'
import { getFestivalIndex, searchArtists, getHotArtists } from '../api.js'
import { Spinner, ErrorBox, Empty, Section, FestCard, ArtistCard } from '../components/ui.jsx'
import { go, enc } from '../router.js'

export default function Search({ q: initial }) {
  const [q, setQ] = useState(initial)
  useEffect(() => setQ(initial), [initial])
  const dq = useDebounced(q.trim(), 300)
  useEffect(() => {
    if (dq !== initial.trim()) history.replaceState(null, '', '#/search' + (dq ? '?q=' + enc(dq) : ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq])

  const artists = useAsync(() => (dq ? searchArtists(dq, 36) : Promise.resolve([])), [dq])
  const idx = useAsync(getFestivalIndex, [])
  const hot = useAsync(() => getHotArtists('all_time'), [])
  const fests = dq ? (idx.data?.festivals || []).filter((f) => f.festival.toLowerCase().includes(dq.toLowerCase())).slice(0, 8) : []

  return (
    <>
      <h1>Search</h1>
      <input class="input" style="margin:1rem 0;max-width:480px" autofocus placeholder="Search artists and festivals…"
        value={q} onInput={(e) => setQ(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && dq && go('/search?q=' + enc(dq))} />
      {!dq ? (
        <Section title="Most booked artists of all time">
          {hot.loading ? <Spinner /> : (
            <div class="grid artists">
              {(hot.data || []).map((a) => <ArtistCard key={a.artist_name} name={a.artist_name} image={a.deezer_image_url} />)}
            </div>
          )}
        </Section>
      ) : (
        <>
          {fests.length > 0 && (
            <Section title="Festivals"><div class="grid fest">{fests.map((f) => <FestCard key={f.key} fest={f} />)}</div></Section>
          )}
          <Section title="Artists">
            {artists.loading ? <Spinner /> : artists.error ? <ErrorBox error={artists.error} /> : (artists.data || []).length === 0 ? (
              <Empty>No artists match “{dq}”.</Empty>
            ) : (
              <div class="grid artists">
                {artists.data.map((a) => <ArtistCard key={a.artist_name} name={a.artist_name} image={a.deezer_image_url} />)}
              </div>
            )}
          </Section>
        </>
      )}
    </>
  )
}
