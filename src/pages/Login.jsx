import { useEffect, useState } from 'preact/hooks'
import { useAuth } from '../auth.jsx'
import { go } from '../router.js'
import { Pills } from '../components/ui.jsx'

export default function Login({ next }) {
  const auth = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (auth.user && !auth.recovery) go(next || '/atlas')
  }, [auth.user])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null); setMsg(null)
    try {
      if (mode === 'signin') await auth.signInPassword(email.trim(), password)
      else if (mode === 'signup') {
        const r = await auth.signUp(email.trim(), password)
        if (r.needsConfirmation) setMsg('Check your email to confirm your account, then sign in.')
      } else if (mode === 'magic') {
        await auth.magicLink(email.trim())
        setMsg('Check your email for a sign-in link.')
      } else {
        await auth.resetPassword(email.trim())
        setMsg('If that email has an account, a reset link is on its way.')
      }
    } catch (e2) {
      setErr(e2.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const needsPw = mode === 'signin' || mode === 'signup'
  return (
    <div class="card auth-box">
      <h2>{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset password' : 'Sign in to FestAtlas'}</h2>
      <p class="muted small">Use the same account as the FestAtlas iOS app and your Atlas is already here.</p>
      <Pills
        value={mode}
        onChange={(m) => { setMode(m); setErr(null); setMsg(null) }}
        options={[
          { id: 'signin', label: 'Password' },
          { id: 'magic', label: 'Email link' },
          { id: 'signup', label: 'Sign up' },
        ]}
      />
      <form onSubmit={submit} style="margin-top:1rem">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" required autocomplete="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
        </div>
        {needsPw && (
          <div class="field">
            <label for="pw">Password</label>
            <input id="pw" type="password" required minLength={6} autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
          </div>
        )}
        {err && <p style="color:var(--bad)">{err}</p>}
        {msg && <p style="color:var(--good)">{msg}</p>}
        <button class="btn primary" disabled={busy} type="submit">
          {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Send link' : 'Send reset link'}
        </button>
        {mode === 'signin' && (
          <button type="button" class="btn small" style="margin-left:.6rem" onClick={() => setMode('reset')}>Forgot password?</button>
        )}
      </form>
    </div>
  )
}

export function ResetPassword() {
  const auth = useAuth()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await auth.updatePassword(pw)
      auth.clearRecovery()
      go('/atlas')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div class="card auth-box">
      <h2>Choose a new password</h2>
      <form onSubmit={submit}>
        <div class="field">
          <label for="npw">New password</label>
          <input id="npw" type="password" required minLength={6} autocomplete="new-password" value={pw} onInput={(e) => setPw(e.currentTarget.value)} />
        </div>
        {err && <p style="color:var(--bad)">{err}</p>}
        <button class="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  )
}
