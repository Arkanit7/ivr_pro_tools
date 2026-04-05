import React, {useState} from 'react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import {saveAs} from 'file-saver'
import {FileAudio, Upload, Play, Loader2, Download} from 'lucide-react'
import {ElevenLabsClient} from '@elevenlabs/elevenlabs-js/wrapper'

// Shadcn UI Components
import {Button} from '@/components/ui/button'
import {Slider} from '@/components/ui/slider'
import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID

const createElevenLabsClient = () => new ElevenLabsClient({apiKey: API_KEY})

const formatDateForUkraine = () => {
  const now = new Date()
  const dateStr = now.toLocaleDateString('uk-UA') // dd.mm.yyyy
  const timeStr = now.toLocaleTimeString('uk-UA') // hh:mm:ss
  return `${dateStr}_${timeStr.replace(/:/g, '.')}` // dd.mm.yyyy_hh.mm.ss
}

export default function ElevenLabsBulkProcessor() {
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
              <FileAudio className="h-8 w-8 text-accent-foreground" />
              Excel to Voice
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-2 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label
                        className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                        htmlFor="speed"
                      >
                        Speed
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Controls the speed of the generated speech. Values below
                        1.0 will slow down the speech, while values above 1.0
                        will speed it up. Extreme values may affect the quality
                        of the generated speech.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm text-muted-foreground">
                    {speed.toFixed(2)}
                  </span>
                </div>
                <Slider
                  id="speed"
                  value={[speed]}
                  onValueChange={(value) => setSpeed(value[0])}
                  min={0.7}
                  max={1.2}
                  step={0.01}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label
                        className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                        htmlFor="stability"
                      >
                        Stability
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Increasing stability will make the voice more consistent
                        between re-generations, but it can also make it sounds a
                        bit monotone. On longer text fragments we recommend
                        lowering this value.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm text-muted-foreground">
                    {(stability * 100).toFixed()}%
                  </span>
                </div>
                <Slider
                  id="stability"
                  value={[stability]}
                  onValueChange={(value) => setStability(value[0])}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label
                        className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                        htmlFor="similarityBoost"
                      >
                        Similarity Boost
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        High enhancement boosts overall voice clarity and target
                        speaker similarity. Very high values can cause
                        artifacts, so adjusting this setting to find the optimal
                        value is encouraged.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm text-muted-foreground">
                    {(similarityBoost * 100).toFixed()}%
                  </span>
                </div>
                <Slider
                  id="similarityBoost"
                  value={[similarityBoost]}
                  onValueChange={(value) => setSimilarityBoost(value[0])}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label
                        className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                        htmlFor="styleExaggeration"
                      >
                        Style Exaggeration
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        High values are recommended if the style of the speech
                        should be exaggerated compared to the uploaded audio.
                        Higher values can lead to more instability in the
                        generated speech. Setting this to 0.0 will greatly
                        increase generation speed and is the default setting.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm text-muted-foreground">
                    {(styleExaggeration * 100).toFixed()}%
                  </span>
                </div>
                <Slider
                  id="styleExaggeration"
                  value={[styleExaggeration]}
                  onValueChange={(value) => setStyleExaggeration(value[0])}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
              <div className="flex items-center justify-between gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label
                      className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                      htmlFor="applyTextNormalization"
                    >
                      Text Normalization
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Controls whether the ElevenLabs client applies text
                      normalization. Use "auto" for automatic behavior, "on" to
                      force normalization, or "off" to disable it.
                    </p>
                  </TooltipContent>
                </Tooltip>
                <span className="text-sm text-muted-foreground capitalize">
                  {applyTextNormalization}
                </span>
              </div>
              <Select
                value={applyTextNormalization}
                onValueChange={(value) => setApplyTextNormalization(value)}
              >
                <SelectTrigger
                  id="applyTextNormalization"
                  aria-label="Text normalization"
                >
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">on</SelectItem>
                  <SelectItem value="off">off</SelectItem>
                  <SelectItem value="auto">auto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              onClick={resetToDefaults}
              className="w-full"
            >
              Reset to Defaults
            </Button>

            <div className="group relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                id="excel-upload"
                onChange={handleFileChange}
              />
              <label
                htmlFor="excel-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card py-10 transition-all hover:border-muted-foreground hover:bg-muted"
              >
                <Upload className="mb-2 h-10 w-10 group-hover:text-accent-foreground" />
                <span className="text-sm font-semibold">
                  {file ? file.name : 'Select IVR Script (Excel)'}
                </span>
                <span className="mt-1 text-xs text-muted-foreground italic">
                  Col A: Filename | Col B: Script Text
                </span>
              </label>
            </div>

            <Button
              className="h-12 w-full text-lg"
              disabled={
                status === 'processing' || status === 'testing' || !file
              }
              onClick={startBulkGeneration}
            >
              {status === 'processing' ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Processing{' '}
                  {progress.current}/{progress.total}
                </>
              ) : status === 'complete' ? (
                <>
                  <Download className="mr-2 h-6 w-6" /> Re-generate Pack
                </>
              ) : (
                <>
                  <Play className="mr-2 h-6 w-6 fill-current" /> Generate All
                  Prompts
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
