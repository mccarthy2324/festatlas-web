import { useAsync } from '../hooks.js'
import { getFestivalIndex, getHotArtists, getNews } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useUser } from '../userdata.jsx'
import { Link, Section, Spinner, ErrorBox, FestCard, Photo } from '../components/ui.jsx'
import { NewsCard } from './News.jsx'
import { enc } from '../router.js'

export default function Home() {
  const { user } = useAuth()
  const u = useUser()
  const idx = useAsync(getFestivalIndex, [])
  const hot = useAsync(() => getHotArtists('yearly'), [])
  const news = useAsync(getNews, [])

  const upcoming = (idx.data?.festivals || [])
    .filter((f) => f.next)
    .sort((a, b) => a.next.start.localeCompare(b.next.start))
    .slice(0, 9)

  return (
    <>
      <div class="hero">
        <h1>Every lineup. Every set time. Your festival Atlas.</h1>
        <p>
          Browse festival lineups and schedules, track the artists you love, log the sets you’ve seen and compare
          festivals side by side. Same data as the FestAtlas app.
        </p>
        <div class="row">
          <Link to="/festivals" class="btn primary">Browse festivals</Link>
          <Link to="/atlas" class="btn">{user ? 'Open My Atlas' : 'Start your Atlas'}</Link>
        </div>
        {user && u.loaded && (
          <p class="small" style="margin-bottom:0">
            Tracking {u.artists.size} artist{u.artists.size === 1 ? '' : 's'} and {u.festivals.size} festival
            {u.festivals.size === 1 ? '' : 's'}.
          </p>
        )}
      </div>

      <Section title="Coming up" action={<Link to="/festivals">All festivals →</Link>}>
        {idx.loading ? <Spinner /> : idx.error ? <ErrorBox error={idx.error} /> : (
          <div class="grid fest">{upcoming.map((f) => <FestCard key={f.key} fest={f} />)}</div>
        )}
      </Section>

      <Section title="Hot artists this year" action={<Link to="/search">Search artists →</Link>}>
        {hot.loading ? <Spinner /> : hot.error ? null : (
          <div class="grid artists">
            {(hot.data || []).slice(0, 12).map((a) => (
              <a key={a.artist_name} class="artist-card" href={'#/artist/' + enc(a.artist_name)}>
                <Photo src={a.deezer_image_url} name={a.artist_name} size={120} />
                <div class="artist-name">{a.artist_name}</div>
                <div class="muted small">{a.festival_count} festivals</div>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title="Latest updates" action={<Link to="/news">All updates →</Link>}>
        {news.loading ? <Spinner /> : news.error ? null : (
          <div class="list">{(news.data || []).slice(0, 5).map((n) => <NewsCard key={n.id} item={n} />)}</div>
        )}
      </Section>
    </>
  )
}
