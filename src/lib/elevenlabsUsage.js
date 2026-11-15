import {useEffect, useSyncExternalStore} from 'react'

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY

// One shared store, so every meter shows the same numbers and a refresh
// triggered by any page updates all of them.
let state = {status: 'idle'}
const listeners = new Set()
const setState = (next) => {
  state = next
  listeners.forEach((listener) => listener())
}

let inflight = null
let queued = false

async function fetchUsage() {
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: {'xi-api-key': API_KEY},
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const missingPermission = body?.detail?.status === 'missing_permissions'
      setState({
        status: 'error',
        reason: missingPermission ? 'permission' : 'other',
        message: body?.detail?.message ?? `HTTP ${res.status}`,
      })
      return
    }
    setState({
      status: 'ok',
      used: body.character_count,
      limit: body.character_limit,
      resetAt: body.next_character_count_reset_unix
        ? new Date(body.next_character_count_reset_unix * 1000)
        : null,
    })
  } catch (error) {
    setState({status: 'error', reason: 'network', message: error.message})
  }
}

// Safe to call often: concurrent calls collapse into one request plus one follow-up.
export function refreshUsage() {
  if (!API_KEY) return
  if (inflight) {
    queued = true
    return
  }
  inflight = fetchUsage().finally(() => {
    inflight = null
    if (queued) {
      queued = false
      refreshUsage()
    }
  })
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useElevenLabsUsage() {
  const usage = useSyncExternalStore(subscribe, () => state)

  useEffect(() => {
    if (state.status === 'idle') refreshUsage()
    // Credits may have been spent elsewhere (dashboard, another tab)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUsage()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return API_KEY ? usage : {status: 'disabled'}
}
