import {createContext, useContext, useEffect, useState} from 'react'
import {MODELS, SAVE_FORMATS} from '@/lib/elevenlabsModels'

const STORAGE_KEY = 'elevenlabs_settings'

const DEFAULT_SETTINGS = {
  model: 'eleven_multilingual_v2',
  speed: 1.0,
  stability: 0.75,
  similarityBoost: 1,
  style: 0,
  textNormalization: 'on',
  saveFormat: 'alw',
}

// Per-page keys used before settings were shared; TTS page values win.
const LEGACY_KEYS = {
  model: ['tts_model', 'bulk_model'],
  speed: ['tts_speed', 'vs_speed'],
  stability: ['tts_stability', 'vs_stability'],
  similarityBoost: ['tts_similarityBoost', 'vs_similarityBoost'],
  style: ['tts_style', 'vs_styleExaggeration'],
  textNormalization: ['tts_textNormalization', 'vs_applyTextNormalization'],
  saveFormat: ['tts_saveFormat', 'bulk_saveFormat'],
}

const isValid = {
  model: (v) => MODELS.some((m) => m.id === v),
  speed: Number.isFinite,
  stability: Number.isFinite,
  similarityBoost: Number.isFinite,
  style: Number.isFinite,
  textNormalization: (v) => ['on', 'off', 'auto'].includes(v),
  saveFormat: (v) => SAVE_FORMATS.some((f) => f.id === v),
}

const sanitize = (raw) =>
  Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
      key,
      raw && isValid[key](raw[key]) ? raw[key] : fallback,
    ]),
  )

const parse = (json) => {
  try {
    return json === null ? undefined : JSON.parse(json)
  } catch {
    return undefined
  }
}

function loadSettings() {
  try {
    const stored = parse(localStorage.getItem(STORAGE_KEY))
    if (stored) return sanitize(stored)

    const legacy = {}
    for (const [key, legacyKeys] of Object.entries(LEGACY_KEYS)) {
      for (const legacyKey of legacyKeys) {
        const value = parse(localStorage.getItem(legacyKey))
        if (value !== undefined && isValid[key](value)) {
          legacy[key] = value
          break
        }
      }
    }
    return sanitize(legacy)
  } catch {
    return DEFAULT_SETTINGS
  }
}

const ElevenLabsSettingsContext = createContext(null)

export function ElevenLabsSettingsProvider({children}) {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (error) {
      console.error('ElevenLabs settings: failed to save', error)
    }
  }, [settings])

  // Keep other open tabs in sync
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY) setSettings(sanitize(parse(e.newValue)))
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const updateSettings = (patch) => setSettings((prev) => ({...prev, ...patch}))
  const resetSettings = () => setSettings(DEFAULT_SETTINGS)

  return (
    <ElevenLabsSettingsContext.Provider
      value={{settings, updateSettings, resetSettings}}
    >
      {children}
    </ElevenLabsSettingsContext.Provider>
  )
}

export function useElevenLabsSettings() {
  const ctx = useContext(ElevenLabsSettingsContext)
  if (!ctx)
    throw new Error(
      'useElevenLabsSettings must be used within ElevenLabsSettingsProvider',
    )
  return ctx
}
