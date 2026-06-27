import {useState, useRef, useEffect} from 'react'
import {useLocalStorage} from '@/hooks/useLocalStorage'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import {saveAs} from 'file-saver'
import {FileAudio} from 'lucide-react'
import {ElevenLabsClient} from '@elevenlabs/elevenlabs-js/wrapper'
import {Button} from '@/components/ui/button'
import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {TooltipProvider} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import VoiceSettings from '@/pages/ElevenlabsBulkProcessorPage/VoiceSettings'
import TextNormalizationSelect from '@/pages/ElevenlabsBulkProcessorPage/TextNormalizationSelect'
import FileUpload from '@/components/FileUpload'
import GenerateButton from '@/pages/ElevenlabsBulkProcessorPage/GenerateButton'
import AudioItemsList from '@/pages/ElevenlabsBulkProcessorPage/AudioItemsList'
import AudioPlayer from '@/components/AudioPlayer/AudioPlayer'
import {decodeAlaw} from '@/pages/AudioEditorPage/alawDecoder'

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID

const createElevenLabsClient = () => new ElevenLabsClient({apiKey: API_KEY})

const MODELS = [
  {id: 'eleven_multilingual_v2', label: 'Multilingual v2'},
  {id: 'eleven_flash_v2_5', label: 'Flash v2.5'},
  {id: 'eleven_v3', label: 'v3 (alpha)'},
]

const SAVE_FORMATS = [
  {id: 'wav', label: '.wav (44.1 kHz)', outputFormat: 'wav_44100'},
  {id: 'alw', label: '.alw (A-law 8 kHz моно)', outputFormat: 'alaw_8000'},
]

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

const formatDate = () => {
  const now = new Date()
  const dateStr = now.toLocaleDateString('uk-UA')
  const timeStr = now.toLocaleTimeString('uk-UA')
  return `${dateStr}_${timeStr.replace(/:/g, '.')}`
}

export default function ElevenlabsBulkProcessorPage() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState({current: 0, total: 0})
  const [audioItems, setAudioItems] = useState([])
  const [audioItemGroups, setAudioItemGroups] = useState([])
  const [model, setModel] = useLocalStorage('bulk_model', 'eleven_multilingual_v2')
  const [saveFormat, setSaveFormat] = useLocalStorage('bulk_saveFormat', 'wav')
  const [speed, setSpeed] = useLocalStorage('vs_speed', 1.0)
  const [stability, setStability] = useLocalStorage('vs_stability', 0.75)
  const [similarityBoost, setSimilarityBoost] = useLocalStorage('vs_similarityBoost', 1)
  const [styleExaggeration, setStyleExaggeration] = useLocalStorage('vs_styleExaggeration', 0)
  const [applyTextNormalization, setApplyTextNormalization] = useLocalStorage(
    'vs_applyTextNormalization',
    'on',
  )
  const [activeAudioId, setActiveAudioId] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const playQueueRef = useRef([])
  const playerRef = useRef(null)
  const prevFormatRef = useRef(saveFormat)

  // Clear generated audio when format changes — bytes would be in the wrong format
  useEffect(() => {
    if (prevFormatRef.current === saveFormat) return
    prevFormatRef.current = saveFormat
    setAudioItems((prev) =>
      prev.map((item) => ({...item, status: 'pending', audioBlob: null, audioUrl: null})),
    )
    setStatus('idle')
    setActiveAudioId(null)
  }, [saveFormat])

  const toFileName = (item) => {
    const ext = saveFormat === 'alw' ? '.alw' : '.wav'
    return item.fileName.replace(/\.(wav|alw)$/i, '') + ext
  }

  const resetToDefaults = () => {
    setModel('eleven_multilingual_v2')
    setSaveFormat('wav')
    setSpeed(1.0)
    setStability(0.75)
    setSimilarityBoost(1)
    setStyleExaggeration(0)
    setApplyTextNormalization('on')
  }

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    if (!selectedFile) {
      setAudioItems([])
      setAudioItemGroups([])
      return
    }

    try {
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1})
      const rows = rawData
        .slice(1)
        .filter(([, text]) => text && text.toString().trim() !== '')

      const items = rows.map(([fileName, text], index) => ({
        id: index,
        fileName: fileName ? fileName.toString().trim() : `prompt_${index + 1}`,
        text: text.toString(),
        status: 'pending',
        audioBlob: null,
        audioUrl: null,
      }))

      const groupMap = new Map()
      for (const item of items) {
        if (!groupMap.has(item.text)) groupMap.set(item.text, [])
        groupMap.get(item.text).push(item.id)
      }
      setAudioItemGroups([...groupMap.values()])
      setAudioItems(items)
    } catch (error) {
      console.error('Error reading Excel file:', error)
      alert('Error reading Excel file. Please check the format.')
      setAudioItems([])
    }
  }

  const generateSpeech = async (text) => {
    const fmt = SAVE_FORMATS.find((f) => f.id === saveFormat)
    const outputFormat = fmt?.outputFormat ?? 'wav_44100'
    const client = createElevenLabsClient()
    const stream = await client.textToSpeech.convert(VOICE_ID, {
      text,
      modelId: model,
      outputFormat,
      languageCode: 'uk',
      applyTextNormalization,
      voiceSettings: {
        speed,
        stability,
        similarityBoost,
        useSpeakerBoost: true,
        style: styleExaggeration,
      },
    })
    return new Response(stream).blob()
  }

  const generateGroupAudio = async (itemIds) => {
    setAudioItems((prev) =>
      prev.map((item) =>
        itemIds.includes(item.id) ? {...item, status: 'processing'} : item,
      ),
    )

    try {
      const sourceItem = audioItems.find((item) => item.id === itemIds[0])
      const rawBlob = await generateSpeech(sourceItem.text)

      let playbackBlob
      if (saveFormat === 'alw') {
        const arrayBuffer = await rawBlob.arrayBuffer()
        const pcm = decodeAlaw(new Uint8Array(arrayBuffer))
        playbackBlob = pcm16ToWavBlob(pcm, 8000)
      } else {
        playbackBlob = rawBlob
      }

      const audioUrl = URL.createObjectURL(playbackBlob)

      setAudioItems((prev) =>
        prev.map((item) =>
          itemIds.includes(item.id)
            ? {...item, status: 'complete', audioBlob: rawBlob, audioUrl}
            : item,
        ),
      )
    } catch (error) {
      console.error(`Error generating audio for group ${itemIds}:`, error)
      setAudioItems((prev) =>
        prev.map((item) =>
          itemIds.includes(item.id) ? {...item, status: 'error'} : item,
        ),
      )
    }
  }

  const downloadGroup = async (itemIds) => {
    const groupItems = audioItems.filter(
      (item) => itemIds.includes(item.id) && item.audioBlob,
    )
    if (groupItems.length === 0) return

    if (groupItems.length === 1) {
      saveAs(groupItems[0].audioBlob, toFileName(groupItems[0]))
      return
    }

    const zip = new JSZip()
    groupItems.forEach((item) => zip.file(toFileName(item), item.audioBlob))
    const blob = await zip.generateAsync({type: 'blob'})
    saveAs(blob, `${groupItems[0].fileName}_group.zip`)
  }

  const onPlay = (itemId) => {
    if (activeAudioId === itemId) {
      if (isPlaying) playerRef.current?.pause()
      else playerRef.current?.play()
    } else {
      playQueueRef.current = []
      setActiveAudioId(itemId)
    }
  }

  const onPlayAll = () => {
    const seen = new Set()
    const queue = audioItems
      .filter((item) => {
        if (seen.has(item.text) || !item.audioUrl) return false
        seen.add(item.text)
        return true
      })
      .map((item) => item.id)

    playQueueRef.current = queue
    if (queue.length > 0) setActiveAudioId(queue[0])
  }

  const handleAudioEnded = () => {
    const queue = playQueueRef.current
    if (!queue.length) return
    const nextIndex = queue.indexOf(activeAudioId) + 1
    if (nextIndex < queue.length) {
      setActiveAudioId(queue[nextIndex])
    } else {
      playQueueRef.current = []
      setActiveAudioId(null)
    }
  }

  const downloadAll = async () => {
    const zip = new JSZip()
    audioItems.forEach((item) => {
      if (!item.audioBlob) return
      zip.file(toFileName(item), item.audioBlob)
    })
    const baseName = file.name.replace(/\.[^.]+$/, '')
    saveAs(await zip.generateAsync({type: 'blob'}), `${baseName}_${formatDate()}.zip`)
  }

  const updateItemText = (itemId, newText) => {
    setAudioItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {...item, text: newText, status: 'pending', audioBlob: null, audioUrl: null}
          : item,
      ),
    )
  }

  const startBulkGeneration = async () => {
    if (!file) return alert('Будь ласка, завантажте Excel файл.')
    if (!API_KEY || API_KEY === 'your-api-key-here')
      return alert('Вкажіть API ключ ElevenLabs у файлі .env.')
    if (!VOICE_ID) return alert('Вкажіть Voice ID ElevenLabs у файлі .env.')

    const seen = new Set()
    const uniqueGroups = []
    for (const item of audioItems) {
      if (!seen.has(item.text)) {
        seen.add(item.text)
        uniqueGroups.push(audioItems.filter((i) => i.text === item.text).map((i) => i.id))
      }
    }

    setStatus('processing')
    setProgress({current: 0, total: uniqueGroups.length})

    for (let i = 0; i < uniqueGroups.length; i++) {
      await generateGroupAudio(uniqueGroups[i])
      setProgress((prev) => ({...prev, current: i + 1}))
    }

    setStatus('complete')
  }

  const activeAudioItem = audioItems.find(
    (item) => item.id === activeAudioId && item.audioUrl,
  )

  return (
    <TooltipProvider>
      {/* -my-8 cancels the py-8 from MainLayout's <main> so the sidebar can be sticky top-0 */}
      <div className="flex -my-8 min-h-screen">

        {/* ── Main content column ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex justify-center py-8 px-6 pb-28">
          <div className="w-full max-w-3xl">
            <Card className="border-none shadow-xl bg-transparent">
              <CardHeader className="border-b pb-6 text-center">
                <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
                  <FileAudio className="h-8 w-8 text-primary" />
                  Excel у голос
                </CardTitle>
              </CardHeader>

              <CardContent className="mt-2 space-y-4">
                <FileUpload file={file} onFileChange={handleFileChange} />

                <GenerateButton
                  status={status}
                  progress={progress}
                  file={file}
                  onClick={startBulkGeneration}
                />

                <AudioItemsList
                  items={audioItems}
                  groups={audioItemGroups}
                  activeAudioId={activeAudioId}
                  isPlaying={isPlaying}
                  onPlay={onPlay}
                  onPlayAll={onPlayAll}
                  onRegenerate={generateGroupAudio}
                  onDownloadGroup={downloadGroup}
                  onDownloadAll={downloadAll}
                  onUpdateText={updateItemText}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Right settings sidebar ──────────────────────────────── */}
        <aside className="scrollbar-thin sticky top-0 h-screen w-108 shrink-0 flex flex-col gap-4 overflow-y-auto border-l border-border bg-background p-3 pb-28">
          <div className="pl-2 py-1">
            <p className="text-lg font-semibold whitespace-nowrap">Налаштування</p>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-3 p-4">
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

          {/* Voice sliders */}
          <VoiceSettings
            speed={speed}
            setSpeed={setSpeed}
            stability={stability}
            setStability={setStability}
            similarityBoost={similarityBoost}
            setSimilarityBoost={setSimilarityBoost}
            styleExaggeration={styleExaggeration}
            setStyleExaggeration={setStyleExaggeration}
          />

          {/* Text normalization */}
          <TextNormalizationSelect
            applyTextNormalization={applyTextNormalization}
            setApplyTextNormalization={setApplyTextNormalization}
          />

          {/* Save format */}
          <div className="flex flex-col gap-3 p-4">
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

      {activeAudioItem && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/50 px-6 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl items-center gap-4">
            <div className="w-52 shrink-0 overflow-hidden">
              <p className="truncate text-sm font-semibold">{activeAudioItem.fileName}</p>
              <p className="truncate text-xs text-muted-foreground">{activeAudioItem.text}</p>
            </div>
            <AudioPlayer
              ref={playerRef}
              src={activeAudioItem.audioUrl}
              downloadBlob={activeAudioItem.audioBlob}
              downloadName={toFileName(activeAudioItem)}
              autoPlay
              onEnded={handleAudioEnded}
              onPlayStateChange={setIsPlaying}
              className="flex-1"
            />
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
