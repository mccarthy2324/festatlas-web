import { useEffect, useState } from 'preact/hooks'
import { configured } from './config.js'
import { AuthProvider, useAuth } from './auth.jsx'
import { UserDataProvider } from './userdata.jsx'
import { useRoute, go, enc } from './router.js'
import { Link } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Festivals from './pages/Festivals.jsx'
import FestivalDetail from './pages/FestivalDetail.jsx'
import Artist from './pages/Artist.jsx'
import Search from './pages/Search.jsx'
import News from './pages/News.jsx'
import Crossover from './pages/Crossover.jsx'
import Atlas from './pages/Atlas.jsx'
import Login, { ResetPassword } from './pages/Login.jsx'
import Profile from './pages/Profile.jsx'

function Setup() {
  return (
    <div class="container" style="padding-top:3rem">
      <div class="card">
        <h2>Almost there: connect your database</h2>
        <p class="muted">
          This build doesn’t have your Supabase settings yet. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> (the same values as <code>SUPABASE_URL</code> and{' '}
          <code>SUPABASE_ANON_KEY</code> in the iOS app) and rebuild. See the README for the exact steps.
        </p>
      </div>
    </div>
  )
}

function Toasts() {
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    let t
    const on = (e) => {
      setMsg(e.detail)
      clearTimeout(t)
      t = setTimeout(() => setMsg(null), 4500)
    }
    addEventListener('fa-toast', on)
    return () => removeEventListener('fa-toast', on)
  }, [])
  return msg ? <div class="toast">{msg}</div> : null
}

function Header({ route }) {
  const { user, ready } = useAuth()
  const [q, setQ] = useState('')
  const first = route.segs[0] || ''
  const is = (...n) => n.includes(first)
  const submit = (e) => {
    e.preventDefault()
    if (q.trim()) go('/search?q=' + enc(q.trim()))
  }
  return (
    <header class="topbar">
      <div class="container">
        <Link to="/" class="brand"><i /> FestAtlas</Link>
        <nav class="nav">
          <Link to="/" class={first === '' ? 'on' : ''}>Home</Link>
          <Link to="/festivals" class={is('festivals', 'festival') ? 'on' : ''}>Festivals</Link>
          <Link to="/search" class={is('search', 'artist') ? 'on' : ''}>Artists</Link>
          <Link to="/news" class={is('news') ? 'on' : ''}>Updates</Link>
          <Link to="/compare" class={is('compare') ? 'on' : ''}>Compare</Link>
          <Link to="/atlas" class={is('atlas') ? 'on' : ''}>My Atlas</Link>
        </nav>
        <div class="spacer" />
        <form class="searchbox" onSubmit={submit}>
          <input value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Search artists…" aria-label="Search artists" />
        </form>
        {ready && (user
          ? <Link to="/profile" class="btn small">Profile</Link>
          : <Link to="/login" class="btn small primary">Sign in</Link>)}
      </div>
    </header>
  )
}

function Router({ route }) {
  const { recovery } = useAuth()
  const [a, b] = route.segs
  if (recovery) return <ResetPassword />
  switch (a) {
    case undefined: return <Home />
    case 'festivals': return <Festivals />
    case 'festival': return <FestivalDetail name={b} params={route.params} />
    case 'artist': return <Artist name={b} />
    case 'search': return <Search q={route.params.q || ''} />
    case 'news': return <News />
    case 'compare': return <Crossover params={route.params} />
    case 'atlas': return <Atlas params={route.params} />
    case 'login': return <Login next={route.params.next} />
    case 'profile': return <Profile />
    default:
      return <div class="empty muted">Page not found. <Link to="/">Go home</Link></div>
  }
}

function Shell() {
  const route = useRoute()
  return (
    <>
      <Header route={route} />
      <main class="container"><Router route={route} /></main>
      <footer class="footer">
        <div class="container">
          FestAtlas is independent and not affiliated with or endorsed by any festival or artist. Festival and artist
          names and logos belong to their owners and are used only to identify events. Artist images and previews are
          provided by Deezer.
        </div>
      </footer>
      <Toasts />
    </>
  )
}

export function App() {
  if (!configured) return <Setup />
  return (
    <AuthProvider>
      <UserDataProvider>
        <Shell />
      </UserDataProvider>
    </AuthProvider>
  )
}
