import {useState} from 'react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import {saveAs} from 'file-saver'
import {FileAudio} from 'lucide-react'
import {ElevenLabsClient} from '@elevenlabs/elevenlabs-js/wrapper'

// Shadcn UI Components
import {Button} from '@/components/ui/button'
import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import {TooltipProvider} from '@/components/ui/tooltip'

// Custom Components
import VoiceSettings from '@/pages/ElevenlabsBulkProcessorPage/VoiceSettings'
import TextNormalizationSelect from '@/pages/ElevenlabsBulkProcessorPage/TextNormalizationSelect'
import FileUpload from '@/components/FileUpload'
import GenerateButton from '@/pages/ElevenlabsBulkProcessorPage/GenerateButton'
import AudioItemsList from '@/pages/ElevenlabsBulkProcessorPage/AudioItemsList'

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID

const createElevenLabsClient = () => new ElevenLabsClient({apiKey: API_KEY})

const formatDateForUkraine = () => {
  const now = new Date()
  const dateStr = now.toLocaleDateString('uk-UA') // dd.mm.yyyy
  const timeStr = now.toLocaleTimeString('uk-UA') // hh:mm:ss
  return `${dateStr}_${timeStr.replace(/:/g, '.')}` // dd.mm.yyyy_hh.mm.ss
}

export default function ElevenlabsBulkProcessor() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState({current: 0, total: 0})
  const [audioItems, setAudioItems] = useState([])
  const [speed, setSpeed] = useState(1.0)
  const [stability, setStability] = useState(0.75)
  const [similarityBoost, setSimilarityBoost] = useState(1)
  const [styleExaggeration, setStyleExaggeration] = useState(0)
  const [applyTextNormalization, setApplyTextNormalization] = useState('on')

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    if (!selectedFile) {
      setAudioItems([])
      return
    }

    try {
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1})
      const allRows = rawData.slice(1) // Skip header row

      const rows = allRows.filter((row) => {
        const [, text] = row
        return text && text.toString().trim() !== ''
      })

      const items = rows.map(([fileName, text], index) => ({
        id: index,
        fileName: fileName ? fileName.toString().trim() : `prompt_${index + 1}`,
        text: text.toString(),
        status: 'pending',
        audioBlob: null,
        audioUrl: null,
      }))

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

  const generateIndividualAudio = async (itemId) => {
    setAudioItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? {...item, status: 'processing'} : item,
      ),
    )

    try {
      const item = audioItems.find((item) => item.id === itemId)
      const audioBlob = await generateSpeech(item.text)
      const audioUrl = URL.createObjectURL(audioBlob)

      setAudioItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {...item, status: 'complete', audioBlob, audioUrl}
            : item,
        ),
      )
    } catch (error) {
      console.error(`Error generating audio for item ${itemId}:`, error)
      setAudioItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? {...item, status: 'error'} : item,
        ),
      )
    }
  }

  const playAudio = (itemId) => {
    const item = audioItems.find((item) => item.id === itemId)
    if (item?.audioUrl) {
      const audio = new Audio(item.audioUrl)
      audio.play()
    }
  }

  const downloadIndividual = (itemId) => {
    const item = audioItems.find((item) => item.id === itemId)
    if (item?.audioBlob) {
      const fileName = item.fileName.toLowerCase().endsWith('.wav')
        ? item.fileName
        : `${item.fileName}.wav`
      saveAs(item.audioBlob, fileName)
    }
  }

  const downloadAll = async () => {
    const zip = new JSZip()

    audioItems.forEach((item) => {
      if (item.audioBlob) {
        let fileName = item.fileName
        if (!fileName.toLowerCase().endsWith('.wav')) {
          fileName += '.wav'
        }
        zip.file(fileName, item.audioBlob)
      }
    })

    const finalZip = await zip.generateAsync({type: 'blob'})
    saveAs(finalZip, `prompt_pack_${formatDateForUkraine()}.zip`)
  }

  const generateSpeech = async (text) => {
    try {
      const client = createElevenLabsClient()
      const stream = await client.textToSpeech.convert(VOICE_ID, {
        text,
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'wav_32000',
        // outputFormat: 'alaw_8000',
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

      return await new Response(stream).blob()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`ElevenLabs API error: ${message}`)
    }
  }

  const startBulkGeneration = async () => {
    if (!file) return alert('Please provide an Excel file.')

    // Validate API credentials
    if (!API_KEY || API_KEY === 'your-api-key-here') {
      alert('Please set your ElevenLabs API key in the .env file.')
      return
    }

    if (!VOICE_ID) {
      alert('Please set your ElevenLabs Voice ID in the .env file.')
      return
    }

    setStatus('processing')
    setProgress({current: 0, total: audioItems.length})

    // Process all items
    for (let i = 0; i < audioItems.length; i++) {
      await generateIndividualAudio(audioItems[i].id)
      setProgress((prev) => ({...prev, current: i + 1}))
    }

    setStatus('complete')
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-full items-center justify-center bg-background p-6">
        <Card className="w-full max-w-4xl border-none shadow-xl">
          <CardHeader className="border-b pb-6 text-center">
            <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
              <FileAudio className="h-8 w-8 text-purple-600" />
              Excel to Voice
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-2 space-y-4">
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

            <Button
              variant="ghost"
              onClick={resetToDefaults}
              className="w-full"
            >
              Reset to Defaults
            </Button>

            <FileUpload file={file} onFileChange={handleFileChange} />

            <AudioItemsList
              items={audioItems}
              onPlay={playAudio}
              onRegenerate={generateIndividualAudio}
              onDownloadIndividual={downloadIndividual}
              onDownloadAll={downloadAll}
            />

            <GenerateButton
              status={status}
              progress={progress}
              file={file}
              onClick={startBulkGeneration}
            />
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
