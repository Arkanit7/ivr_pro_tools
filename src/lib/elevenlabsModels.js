// Capabilities checked against GET /v1/models and live API requests.
// Unsupported settings are disabled in the UI and left out of requests:
// v3/v4 silently ignore speed/style/speaker boost, and v3 rejects context with a 400.
export const MODELS = [
  {
    id: 'eleven_multilingual_v2',
    label: 'Multilingual v2',
    supports: {speed: true, style: true, speakerBoost: true, context: true},
  },
  {
    id: 'eleven_flash_v2_5',
    label: 'Flash v2.5',
    supports: {speed: true, style: false, speakerBoost: false, context: true},
  },
  {
    id: 'eleven_v3',
    label: 'v3',
    supports: {speed: false, style: false, speakerBoost: false, context: false},
  },
  {
    id: 'eleven_v4',
    label: 'v4',
    supports: {speed: false, style: false, speakerBoost: false, context: true},
  },
  {
    id: 'eleven_v4_turbo',
    label: 'v4 Turbo',
    supports: {speed: false, style: false, speakerBoost: false, context: true},
  },
]

export const getModel = (id) => MODELS.find((m) => m.id === id) ?? MODELS[0]

export const UNSUPPORTED_HINTS = {
  speed: 'Працює лише з моделями v2.x (Multilingual v2, Flash v2.5)',
  style: 'Працює лише з моделлю Multilingual v2',
  context: 'Модель v3 не підтримує контекст',
}
