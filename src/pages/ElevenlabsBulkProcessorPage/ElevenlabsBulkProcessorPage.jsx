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
  const [speed, setSpeed] = useState(1.0)
  const [stability, setStability] = useState(0.75)
  const [similarityBoost, setSimilarityBoost] = useState(1)
  const [styleExaggeration, setStyleExaggeration] = useState(0)
  const [applyTextNormalization, setApplyTextNormalization] = useState('on')

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0])
  }

  const resetToDefaults = () => {
    setSpeed(1.0)
    setStability(0.75)
    setSimilarityBoost(1)
    setStyleExaggeration(0)
    setApplyTextNormalization('on')
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
    const zip = new JSZip()

    try {
      // 2. Read Excel Data
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1})
      const allRows = rawData.slice(1) // Skip header row

      // Filter out empty rows (rows with no text in the second column)
      const rows = allRows.filter((row) => {
        const [, text] = row
        return text && text.toString().trim() !== ''
      })

      console.log('Raw Excel data (first 5 rows):', rawData.slice(0, 5))
      console.log('Total rows found (excluding header):', allRows.length)
      console.log('Rows with content:', rows.length)

      setProgress({current: 0, total: rows.length})

      let processedCount = 0

      // 3. Process Rows Sequentially
      for (let i = 0; i < rows.length; i++) {
        const [fileName, text] = rows[i]
        console.log(`Processing row ${i + 1}:`, {fileName, text})

        try {
          // Generate speech using direct API call
          const audioBlob = await generateSpeech(text.toString())

          // Use filename as-is, just ensure .wav extension
          let safeName = fileName
            ? fileName.toString().trim()
            : `prompt_${i + 1}.wav`

          // Add .wav extension if not present
          if (!safeName.toLowerCase().endsWith('.wav')) {
            safeName += '.wav'
          }

          // Ensure unique filenames
          let counter = 1
          const baseName = safeName.replace('.wav', '')
          while (zip.file(safeName)) {
            safeName = `${baseName}_${counter}.wav`
            counter++
          }

          console.log(`Adding file to ZIP: ${safeName}`)
          zip.file(safeName, audioBlob)
          processedCount++

          setProgress((prev) => ({...prev, current: processedCount}))
        } catch (error) {
          console.error(`Error processing row ${i + 1}:`, error)
          // Continue with next row instead of stopping completely
          continue
        }
      }

      console.log(`Processing complete. Files added to ZIP: ${processedCount}`)

      // 4. Finalize ZIP
      console.log('Generating ZIP file...')
      const finalZip = await zip.generateAsync({type: 'blob'})

      // List all files in the ZIP
      const zipContents = []
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          zipContents.push(relativePath)
        }
      })
      console.log('ZIP contents:', zipContents)

      saveAs(finalZip, `prompt_pack_${formatDateForUkraine()}.zip`)
      setStatus('complete')
    } catch (error) {
      console.error('TTS Error:', error)
      alert('Error during generation. Check your API key and Voice ID.')
      setStatus('idle')
    }
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-full items-center justify-center bg-background p-6">
        <Card className="w-full max-w-xl border-none shadow-xl">
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
