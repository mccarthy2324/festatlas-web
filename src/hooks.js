import { useState, useEffect, useRef } from 'preact/hooks'

// Runs `fn` whenever deps change; ignores stale responses.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const seq = useRef(0)
  useEffect(() => {
    const id = ++seq.current
    setState((s) => ({ data: s.data, error: null, loading: true }))
    Promise.resolve()
      .then(fn)
      .then(
        (data) => id === seq.current && setState({ data, error: null, loading: false }),
        (error) => id === seq.current && setState({ data: null, error, loading: false })
      )
    return () => { seq.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export function toast(message) {
  dispatchEvent(new CustomEvent('fa-toast', { detail: String(message) }))
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}
