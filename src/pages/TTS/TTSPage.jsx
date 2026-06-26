import {useState, useRef, useEffect} from 'react'
import {useLocalStorage} from '@/hooks/useLocalStorage'
import {Mic2, Download} from 'lucide-react'
import {cn} from '@/lib/utils'
import {decodeAlaw} from '@/pages/AudioEditorPage/alawDecoder'
import {PageShell} from '@/components/PageShell'
import {Button} from '@/components/ui/button'
import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import {Textarea} from '@/components/ui/textarea'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Slider} from '@/components/ui/slider'
import {Switch} from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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
  const str = (off, s) => [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, dataSize, true)
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true)
  return new Blob([buf], {type: 'audio/wav'})
}

function SliderField({label, tooltip, value, onValueChange, min, max, step, format}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
      <div className="flex items-center justify-between gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">
              {label}
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
        <span className="tabular-nums text-sm text-muted-foreground">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onValueChange(v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  )
}

export default function TTSPage() {
  const [textBefore, setTextBefore] = useLocalStorage('tts_textBefore', '')
  const [text, setText] = useLocalStorage('tts_text', '')
  const [textAfter, setTextAfter] = useLocalStorage('tts_textAfter', '')
  const [fileName, setFileName] = useLocalStorage('tts_fileName', 'output')
  const [model, setModel] = useLocalStorage('tts_model', 'eleven_multilingual_v2')
  const [stability, setStability] = useLocalStorage('tts_stability', 0.75)
  const [similarityBoost, setSimilarityBoost] = useLocalStorage('tts_similarityBoost', 1.0)
  const [style, setStyle] = useLocalStorage('tts_style', 0)
  const [speakerBoost, setSpeakerBoost] = useLocalStorage('tts_speakerBoost', true)
  const [speed, setSpeed] = useLocalStorage('tts_speed', 1.0)
  const [textNormalization, setTextNormalization] = useLocalStorage('tts_textNormalization', 'on')
  const [saveFormat, setSaveFormat] = useLocalStorage('tts_saveFormat', 'alw')

  const [isGenerating, setIsGenerating] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [rawBytes, setRawBytes] = useState(null)
  const [playKey, setPlayKey] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [isError, setIsError] = useState(false)

  const audioRef = useRef(null)
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
      text: text.trim(),
      model_id: model,
      language_code: 'uk',
      apply_text_normalization: textNormalization,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: speakerBoost,
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
      setPlayKey((k) => k + 1)
      setStatusMsg('Готово.')
      setIsError(false)
    } catch (err) {
      setStatusMsg(err.message)
      setIsError(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = () => {
    if (!rawBytes) return
    const ext = saveFormat === 'alw' ? '.alw' : '.wav'
    const name = (fileName.trim() || 'output') + ext
    const blob = new Blob([rawBytes], {type: 'application/octet-stream'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const fileNameInvalid = fileName !== '' && [...fileName].some((c) => !VALID_FILENAME_CHAR.test(c))

  return (
    <TooltipProvider>
      <PageShell className="pb-28 items-start">
        <Card className="w-full max-w-5xl border-none shadow-xl">
          <CardHeader className="border-b pb-6 text-center">
            <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
              <Mic2 className="h-8 w-8 text-primary" />
              Синтез мовлення
            </CardTitle>
          </CardHeader>

          <CardContent className="mt-4">
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">

              {/* Left column — text inputs */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Назва файлу
                  </Label>
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="output"
                    className={cn(
                      'h-11 text-lg font-bold',
                      fileNameInvalid && 'border-destructive focus-visible:ring-destructive',
                    )}
                  />
                  {fileNameInvalid && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-destructive">
                        Тільки латинські символи, цифри, <code>_</code> та <code>-</code>. Недопустимі символи:
                      </p>
                      <p className="font-mono text-sm leading-relaxed">
                        {[...fileName].map((char, i) => {
                          const bad = !VALID_FILENAME_CHAR.test(char)
                          const display = char === ' ' ? '␣' : char === '\t' ? '⇥' : char === '\n' ? '↵' : char
                          return bad ? (
                            <mark key={i} className="rounded bg-destructive/20 px-0.5 text-destructive not-italic">
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

                <div className="space-y-1">
                  <Label>Текст до (контекст — не озвучується)</Label>
                  <Textarea
                    value={textBefore}
                    onChange={(e) => setTextBefore(e.target.value)}
                    placeholder="Контекст перед основним текстом (впливає на просодію)"
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Текст для озвучення</Label>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Введіть текст для синтезу…"
                    rows={8}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Текст після (контекст — не озвучується)</Label>
                  <Textarea
                    value={textAfter}
                    onChange={(e) => setTextAfter(e.target.value)}
                    placeholder="Контекст після основного тексту (впливає на просодію)"
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-1">
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

                <Button onClick={handleGenerate} disabled={isGenerating || fileNameInvalid} className="w-full">
                  {isGenerating ? 'Генерація…' : 'Генерувати'}
                </Button>

                {statusMsg && (
                  <p className={`text-sm ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {statusMsg}
                  </p>
                )}
              </div>

              {/* Right column — voice settings */}
              <div className="space-y-2">
                <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
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

                <SliderField
                  label="Швидкість"
                  tooltip="Контролює швидкість мовлення. Значення нижче 1.0 сповільнюють, вище 1.0 — прискорюють. Екстремальні значення можуть знизити якість генерації."
                  value={speed}
                  onValueChange={setSpeed}
                  min={0.7}
                  max={1.2}
                  step={0.01}
                  format={(v) => v.toFixed(2)}
                />
                <SliderField
                  label="Стабільність"
                  tooltip="Вища стабільність робить голос консистентнішим між генераціями, але може звучати монотонно. Для довгих текстів рекомендуємо знижувати це значення."
                  value={stability}
                  onValueChange={setStability}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(v) => `${(v * 100).toFixed()}%`}
                />
                <SliderField
                  label="Схожість"
                  tooltip="Висока схожість покращує чіткість голосу та відповідність оригіналу. Дуже високі значення можуть спричинити артефакти."
                  value={similarityBoost}
                  onValueChange={setSimilarityBoost}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(v) => `${(v * 100).toFixed()}%`}
                />
                <SliderField
                  label="Стиль"
                  tooltip="Високі значення підкреслюють стиль мовлення. Можуть спричинити нестабільність генерації. Значення 0.0 — стандартне та значно прискорює генерацію."
                  value={style}
                  onValueChange={setStyle}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(v) => `${(v * 100).toFixed()}%`}
                />

                <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor="speakerBoost"
                          className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2"
                        >
                          Підсилення динаміка
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Підвищує схожість з оригінальним голосом. Рекомендується для більшості випадків.</p>
                      </TooltipContent>
                    </Tooltip>
                    <Switch
                      id="speakerBoost"
                      checked={speakerBoost}
                      onCheckedChange={setSpeakerBoost}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">
                          Нормалізація тексту
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Визначає, чи застосовує ElevenLabs нормалізацію тексту. «auto» — автоматично, «on» — завжди, «off» — ніколи.</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-sm capitalize text-muted-foreground">{textNormalization}</span>
                  </div>
                  <Select value={textNormalization} onValueChange={setTextNormalization}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">auto</SelectItem>
                      <SelectItem value="on">on</SelectItem>
                      <SelectItem value="off">off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>
          </CardContent>
        </Card>
      </PageShell>

      {audioUrl && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/50 px-6 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {(fileName.trim() || 'output') + (saveFormat === 'alw' ? '.alw' : '.wav')}
              </p>
              <p className="truncate text-xs text-muted-foreground">{text.trim().slice(0, 100)}</p>
            </div>
            <audio
              ref={audioRef}
              key={playKey}
              controls
              autoPlay
              src={audioUrl}
              className="w-full max-w-2xl"
            />
            <Button variant="outline" size="sm" onClick={handleSave} className="shrink-0">
              <Download className="mr-2 h-4 w-4" />
              Зберегти
            </Button>
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
