import { useState, useEffect } from 'preact/hooks'

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/'
  const u = new URL(raw, 'http://x')
  return {
    path: u.pathname,
    params: Object.fromEntries(u.searchParams),
    segs: u.pathname.split('/').filter(Boolean).map((s) => {
      try { return decodeURIComponent(s) } catch { return s }
    }),
  }
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    let last = parse().path
    const onChange = () => {
      const r = parse()
      setRoute(r)
      if (r.path !== last) window.scrollTo(0, 0)
      last = r.path
    }
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function go(to) {
  location.hash = to
}

export const enc = encodeURIComponent
