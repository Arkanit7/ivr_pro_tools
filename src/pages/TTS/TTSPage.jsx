import {useState, useRef, useEffect, useMemo} from 'react'
import {useLocalStorage} from '@/hooks/useLocalStorage'
import {Mic2, Wand2} from 'lucide-react'
import {cn} from '@/lib/utils'
import AudioPlayer from '@/components/AudioPlayer/AudioPlayer'
import {decodeAlaw} from '@/pages/AudioEditorPage/alawDecoder'
import normalizeForTTS from '@/lib/normalizeForTTS'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {TooltipProvider} from '@/components/ui/tooltip'
import VoiceSettings from '@/pages/ElevenlabsBulkProcessorPage/VoiceSettings'
import TextNormalizationSelect from '@/pages/ElevenlabsBulkProcessorPage/TextNormalizationSelect'

// API key is read from env — exposes the key in the client bundle.
// For local/dev use only; use a backend proxy for anything shared.
const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID

const VALID_FILENAME_CHAR = /^[a-zA-Z0-9_-]$/

const MODELS = [
  {id: 'eleven_multilingual_v2', label: 'Multilingual v2'},
  {id: 'eleven_flash_v2_5', label: 'Flash v2.5'},
  {id: 'eleven_v3', label: 'v3 (alpha)'},
]

// .wav (44.1 kHz) requires a Pro tier or above on the ElevenLabs account; alaw_8000 does not.
const SAVE_FORMATS = [
  {id: 'alw', label: '.alw (A-law 8 kHz моно)', outputFormat: 'alaw_8000'},
  {id: 'wav', label: '.wav (44.1 kHz)', outputFormat: 'wav_44100'},
]

// Build an in-memory WAV blob from 16-bit PCM samples so the <audio> element can play A-law output.
function pcm16ToWavBlob(pcm, sampleRate) {
  const dataSize = pcm.length * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const v = new DataView(buf)
  const str = (off, s) =>
    [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + dataSize, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, dataSize, true)
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true)
  return new Blob([buf], {type: 'audio/wav'})
}

export default function TTSPage() {
  const [textBefore, setTextBefore] = useLocalStorage('tts_textBefore', '')
  const [text, setText] = useLocalStorage('tts_text', '')
  const [textAfter, setTextAfter] = useLocalStorage('tts_textAfter', '')
  const [fileName, setFileName] = useLocalStorage('tts_fileName', 'output')
  const [model, setModel] = useLocalStorage(
    'tts_model',
    'eleven_multilingual_v2',
  )
  const [stability, setStability] = useLocalStorage('tts_stability', 0.75)
  const [similarityBoost, setSimilarityBoost] = useLocalStorage(
    'tts_similarityBoost',
    1.0,
  )
  const [style, setStyle] = useLocalStorage('tts_style', 0)
  const [speed, setSpeed] = useLocalStorage('tts_speed', 1.0)
  const [textNormalization, setTextNormalization] = useLocalStorage(
    'tts_textNormalization',
    'on',
  )
  const [saveFormat, setSaveFormat] = useLocalStorage('tts_saveFormat', 'alw')

  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [rawBytes, setRawBytes] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [isError, setIsError] = useState(false)

  const audioUrlRef = useRef(null)
  const prevFormatRef = useRef(saveFormat)

  const setAudioUrlClean = (url) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = url
    setAudioUrl(url)
  }

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  // Clear audio when save format changes to prevent format/bytes mismatch on save
  useEffect(() => {
    if (prevFormatRef.current === saveFormat) return
    prevFormatRef.current = saveFormat
    setAudioUrlClean(null)
    setRawBytes(null)
    setStatusMsg('')
    setIsError(false)
  }, [saveFormat])

  const handleGenerate = async () => {
    if (!API_KEY) {
      setStatusMsg('Вкажіть VITE_ELEVENLABS_API_KEY у файлі .env.')
      setIsError(true)
      return
    }
    if (!VOICE_ID) {
      setStatusMsg('Вкажіть VITE_ELEVENLABS_VOICE_ID у файлі .env.')
      setIsError(true)
      return
    }
    if (!text.trim()) {
      setStatusMsg('Введіть текст для озвучення.')
      setIsError(true)
      return
    }

    setAudioUrlClean(null)
    setRawBytes(null)
    setIsGenerating(true)
    setStatusMsg('Генерація…')
    setIsError(false)

    const fmt = SAVE_FORMATS.find((f) => f.id === saveFormat)
    const outputFormat = fmt?.outputFormat ?? 'alaw_8000'

    const body = {
      text: normalizeForTTS(text.trim()),
      model_id: model,
      language_code: 'uk',
      apply_text_normalization: textNormalization,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: true,
        speed,
      },
    }
    if (textBefore.trim()) body.previous_text = textBefore.trim()
    if (textAfter.trim()) body.next_text = textAfter.trim()

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${outputFormat}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      )

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Помилка API ${res.status}: ${errText}`)
      }

      const arrayBuffer = await res.arrayBuffer()

      // Copy raw bytes for saving before any operation that may detach the ArrayBuffer
      const saved = new Uint8Array(arrayBuffer.slice(0))
      setRawBytes(saved)

      let playbackBlob
      if (saveFormat === 'alw') {
        // Decode raw A-law bytes → PCM16 → in-memory WAV for the <audio> element
        const pcm = decodeAlaw(new Uint8Array(arrayBuffer))
        playbackBlob = pcm16ToWavBlob(pcm, 8000)
      } else {
        playbackBlob = new Blob([saved], {type: 'audio/wav'})
      }

      setAudioUrlClean(URL.createObjectURL(playbackBlob))
      setStatusMsg('Готово.')
      setIsError(false)
    } catch (err) {
      setStatusMsg(err.message)
      setIsError(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const resetToDefaults = () => {
    setModel('eleven_multilingual_v2')
    setStability(0.75)
    setSimilarityBoost(1.0)
    setStyle(0)
    setSpeed(1.0)
    setTextNormalization('on')
  }

  const fileNameInvalid =
    fileName !== '' && [...fileName].some((c) => !VALID_FILENAME_CHAR.test(c))
  const ext = saveFormat === 'alw' ? '.alw' : '.wav'
  const downloadName = (fileName.trim() || 'IVR_Pro_Tools') + ext
  const getDownloadName = () =>
    (fileName.trim() ||
      'IVR_Pro_Tools_' +
        new Date().toISOString().slice(0, 19).replace(/:/g, '_')) + ext
  const downloadBlob = useMemo(
    () =>
      rawBytes
        ? new Blob([rawBytes], {type: 'application/octet-stream'})
        : null,
    [rawBytes],
  )

  const handleDownload = () => {
    if (!downloadBlob) return
    const url = URL.createObjectURL(downloadBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = getDownloadName()
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TooltipProvider>
      {/* -my-8 cancels the py-8 from MainLayout's <main> so the sidebar can be sticky top-0 */}
      <div className="-my-8 flex min-h-screen">
        {/* ── Center content column ───────────────────────────────── */}
        <div className="flex min-w-0 flex-1 justify-center px-6 py-5 pb-24">
          <div className="w-full max-w-2xl space-y-3">
            {/* Heading */}
            <div className="flex items-center gap-3">
              <Mic2 className="h-7 w-7 shrink-0 text-primary" />
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Синтез мовлення
                </h1>
              </div>
            </div>

            {/* File name */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Назва файлу
              </Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="output"
                className={cn(
                  'h-9 font-semibold',
                  fileNameInvalid &&
                    'border-destructive focus-visible:ring-destructive',
                )}
              />
              {fileNameInvalid && (
                <div className="space-y-0.5">
                  <p className="text-xs text-destructive">
                    Тільки латинські символи, цифри, <code>_</code> та{' '}
                    <code>-</code>. Недопустимі символи:
                  </p>
                  <p className="font-mono text-sm leading-relaxed">
                    {[...fileName].map((char, i) => {
                      const bad = !VALID_FILENAME_CHAR.test(char)
                      const display =
                        char === ' '
                          ? '␣'
                          : char === '\t'
                            ? '⇥'
                            : char === '\n'
                              ? '↵'
                              : char
                      return bad ? (
                        <mark
                          key={i}
                          className="rounded bg-destructive/20 px-0.5 text-destructive not-italic"
                        >
                          {display}
                        </mark>
                      ) : (
                        <span key={i}>{display}</span>
                      )
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Context before */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Контекст до{' '}
                <span className="font-normal normal-case opacity-60">
                  — не озвучується
                </span>
              </Label>
              <Textarea
                value={textBefore}
                onChange={(e) => setTextBefore(e.target.value)}
                rows={1}
                className="min-h-9 resize-y"
              />
            </div>

            {/* Main text */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Текст для озвучення
              </Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Введіть текст для синтезу…"
                rows={5}
                className="min-h-28 resize-y"
              />
            </div>

            {/* Context after */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Контекст після{' '}
                <span className="font-normal normal-case opacity-60">
                  — не озвучується
                </span>
              </Label>
              <Textarea
                value={textAfter}
                onChange={(e) => setTextAfter(e.target.value)}
                rows={1}
                className="min-h-9 resize-y"
              />
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  if (textBefore) setTextBefore(normalizeForTTS(textBefore))
                  if (text) setText(normalizeForTTS(text))
                  if (textAfter) setTextAfter(normalizeForTTS(textAfter))
                }}
              >
                <Wand2 className="mr-2 h-3.5 w-3.5" />
                Нормалізувати текст
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || fileNameInvalid}
                  className="h-10 flex-1"
                >
                  {isGenerating ? 'Генерація…' : 'Генерувати'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={!downloadBlob}
                  className="h-10 px-6"
                >
                  Завантажити
                </Button>
              </div>

              {statusMsg && (
                <p
                  className={cn(
                    'text-center text-sm',
                    isError ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {statusMsg}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right settings sidebar ──────────────────────────────── */}
        <aside className="scrollbar-thin sticky top-0 flex h-screen w-80 shrink-0 flex-col gap-1 overflow-y-auto border-l border-border bg-background p-3 pb-20">
          <div className="py-1 pl-2">
            <p className="text-lg font-semibold whitespace-nowrap">
              Налаштування
            </p>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-3 p-1.5">
            <Label>Модель</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <VoiceSettings
            speed={speed}
            setSpeed={setSpeed}
            stability={stability}
            setStability={setStability}
            similarityBoost={similarityBoost}
            setSimilarityBoost={setSimilarityBoost}
            styleExaggeration={style}
            setStyleExaggeration={setStyle}
          />

          <TextNormalizationSelect
            applyTextNormalization={textNormalization}
            setApplyTextNormalization={setTextNormalization}
          />

          {/* Save format */}
          <div className="flex flex-col gap-3 p-1.5">
            <Label>Зберегти як</Label>
            <Select value={saveFormat} onValueChange={setSaveFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAVE_FORMATS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" onClick={resetToDefaults} className="w-full">
            Скинути до стандартних
          </Button>
        </aside>
      </div>

      {audioUrl && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/50 py-4 pr-6 pl-22 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center gap-4">
            <div className="w-52 shrink-0 overflow-hidden">
              <p className="truncate text-sm font-semibold">{downloadName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {text.trim().slice(0, 80)}
              </p>
            </div>
            <AudioPlayer
              src={audioUrl}
              downloadBlob={downloadBlob}
              downloadName={downloadName}
              getDownloadName={getDownloadName}
              autoPlay
              className="flex-1"
            />
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
