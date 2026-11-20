import { useEffect, useState } from 'preact/hooks'
import { useAuth } from '../auth.jsx'
import { useAsync, toast } from '../hooks.js'
import { getProfile, saveProfile, handleAvailable } from '../api.js'
import { Spinner, Link } from '../components/ui.jsx'
import { go } from '../router.js'

export default function Profile() {
  const { user, ready, signOut } = useAuth()
  const prof = useAsync(() => (user ? getProfile(user.id) : null), [user?.id])
  const [f, setF] = useState({ display_name: '', handle: '', bio: '', location: '', is_public: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (prof.data) {
      setF({
        display_name: prof.data.display_name || '',
        handle: prof.data.handle || '',
        bio: prof.data.bio || '',
        location: prof.data.location || '',
        is_public: prof.data.is_public ?? true,
      })
    }
  }, [prof.data])

  if (!ready) return <Spinner />
  if (!user) return <div class="empty muted"><Link to="/login?next=%2Fprofile">Sign in</Link> to view your profile.</div>

  const set = (k) => (e) => setF({ ...f, [k]: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const handle = f.handle.trim().replace(/^@/, '')
      if (handle && !/^[A-Za-z0-9_.]{3,20}$/.test(handle)) throw new Error('Handle must be 3–20 letters, numbers, dots or underscores.')
      if (handle && !(await handleAvailable(handle))) throw new Error('That handle is taken.')
      await saveProfile(user.id, {
        display_name: f.display_name.trim() || null,
        handle: handle || null,
        bio: f.bio.trim() || null,
        location: f.location.trim() || null,
        is_public: f.is_public,
      })
      toast('Profile saved')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="auth-box" style="max-width:560px">
      <h1>Profile</h1>
      <p class="muted">{user.email}</p>
      {prof.loading ? <Spinner /> : (
        <form class="card" onSubmit={save}>
          <div class="field"><label>Display name</label><input value={f.display_name} onInput={set('display_name')} maxLength={60} /></div>
          <div class="field"><label>Handle</label><input value={f.handle} onInput={set('handle')} maxLength={21} placeholder="@yourname" /></div>
          <div class="field"><label>Bio</label><textarea rows={3} value={f.bio} onInput={set('bio')} maxLength={280} /></div>
          <div class="field"><label>Location</label><input value={f.location} onInput={set('location')} maxLength={60} /></div>
          <label class="row small muted" style="margin-bottom:1rem;gap:.4rem">
            <input type="checkbox" checked={f.is_public} onChange={set('is_public')} /> Public profile (people can find you in search)
          </label>
          {err && <p style="color:var(--bad)">{err}</p>}
          <button class="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>
      )}
      <div class="card" style="margin-top:1rem">
        <div class="row" style="justify-content:space-between">
          <span>Signed in</span>
          <button class="btn" onClick={async () => { await signOut(); go('/') }}>Sign out</button>
        </div>
        <p class="muted small" style="margin-bottom:0">
          Friends, privacy settings and account deletion live in the FestAtlas iOS app. To have your account deleted
          from the web, email festatlas1@gmail.com.
        </p>
      </div>
    </div>
  )
}
