import {useState, useRef} from 'react'
import {useLocalStorage} from '@/hooks/useLocalStorage'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import {saveAs} from 'file-saver'
import {FileAudio, ChevronDown} from 'lucide-react'
import {ElevenLabsClient} from '@elevenlabs/elevenlabs-js/wrapper'
import {Button} from '@/components/ui/button'
import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import {TooltipProvider} from '@/components/ui/tooltip'
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/ui/collapsible'
import {PageShell} from '@/components/PageShell'
import VoiceSettings from '@/pages/ElevenlabsBulkProcessorPage/VoiceSettings'
import TextNormalizationSelect from '@/pages/ElevenlabsBulkProcessorPage/TextNormalizationSelect'
import FileUpload from '@/components/FileUpload'
import GenerateButton from '@/pages/ElevenlabsBulkProcessorPage/GenerateButton'
import AudioItemsList from '@/pages/ElevenlabsBulkProcessorPage/AudioItemsList'

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID

const createElevenLabsClient = () => new ElevenLabsClient({apiKey: API_KEY})

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
  const [speed, setSpeed] = useLocalStorage('vs_speed', 1.0)
  const [stability, setStability] = useLocalStorage('vs_stability', 0.75)
  const [similarityBoost, setSimilarityBoost] = useLocalStorage('vs_similarityBoost', 1)
  const [styleExaggeration, setStyleExaggeration] = useLocalStorage('vs_styleExaggeration', 0)
  const [applyTextNormalization, setApplyTextNormalization] = useLocalStorage(
    'vs_applyTextNormalization',
    'on',
  )
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false)
  const [activeAudioId, setActiveAudioId] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playKey, setPlayKey] = useState(0)
  const playQueueRef = useRef([])
  const audioRef = useRef(null)

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

  const resetToDefaults = () => {
    setSpeed(1.0)
    setStability(0.75)
    setSimilarityBoost(1)
    setStyleExaggeration(0)
    setApplyTextNormalization('on')
  }

  const generateSpeech = async (text) => {
    const client = createElevenLabsClient()
    const stream = await client.textToSpeech.convert(VOICE_ID, {
      text,
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'wav_32000',
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
      const audioBlob = await generateSpeech(sourceItem.text)
      const audioUrl = URL.createObjectURL(audioBlob)

      setAudioItems((prev) =>
        prev.map((item) =>
          itemIds.includes(item.id)
            ? {...item, status: 'complete', audioBlob, audioUrl}
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

    const toFileName = (item) =>
      item.fileName.toLowerCase().endsWith('.wav') ? item.fileName : `${item.fileName}.wav`

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
      if (isPlaying) {
        audioRef.current?.pause()
      } else if (audioRef.current?.ended) {
        setPlayKey((k) => k + 1)
      } else {
        audioRef.current?.play()
      }
    } else {
      playQueueRef.current = []
      setActiveAudioId(itemId)
      setPlayKey((k) => k + 1)
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
    if (queue.length > 0) {
      setActiveAudioId(queue[0])
      setPlayKey((k) => k + 1)
    }
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
    const queue = playQueueRef.current
    if (!queue.length) return
    const nextIndex = queue.indexOf(activeAudioId) + 1
    if (nextIndex < queue.length) {
      setActiveAudioId(queue[nextIndex])
      setPlayKey((k) => k + 1)
    } else {
      playQueueRef.current = []
      setActiveAudioId(null)
    }
  }

  const downloadAll = async () => {
    const zip = new JSZip()
    audioItems.forEach((item) => {
      if (!item.audioBlob) return
      const fileName = item.fileName.toLowerCase().endsWith('.wav')
        ? item.fileName
        : `${item.fileName}.wav`
      zip.file(fileName, item.audioBlob)
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
      <PageShell className="pb-28">
        <Card className="w-full max-w-3xl border-none shadow-xl">
          <CardHeader className="border-b pb-6 text-center">
            <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
              <FileAudio className="h-8 w-8 text-primary" />
              Excel у голос
            </CardTitle>
          </CardHeader>

          <CardContent className="mt-2 space-y-4">
            <Collapsible open={isVoiceSettingsOpen} onOpenChange={setIsVoiceSettingsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Налаштування голосу
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4">
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
                <TextNormalizationSelect
                  applyTextNormalization={applyTextNormalization}
                  setApplyTextNormalization={setApplyTextNormalization}
                />
                <Button variant="ghost" onClick={resetToDefaults} className="w-full">
                  Скинути до стандартних
                </Button>
              </CollapsibleContent>
            </Collapsible>

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
      </PageShell>

      {activeAudioItem && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/50 px-6 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeAudioItem.fileName}</p>
              <p className="truncate text-xs text-muted-foreground">{activeAudioItem.text}</p>
            </div>
            <audio
              ref={audioRef}
              key={playKey}
              controls
              autoPlay
              src={activeAudioItem.audioUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={handleAudioEnded}
              className="w-full max-w-2xl"
            />
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
