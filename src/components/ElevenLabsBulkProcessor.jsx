import React, {useState} from 'react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import {saveAs} from 'file-saver'
import {
  FileAudio,
  Upload,
  Play,
  Loader2,
  Download,
  ShieldCheck,
} from 'lucide-react'

// Shadcn UI Components
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import {Label} from '@/components/ui/label'

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY
const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID

export default function ElevenLabsBulkProcessor() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState({current: 0, total: 0})

  const testAPIConnection = async () => {
    if (!API_KEY || API_KEY === 'your-api-key-here') {
      alert('Please set your ElevenLabs API key in the .env file.')
      return
    }

    if (!VOICE_ID) {
      alert('Please set your ElevenLabs Voice ID in the .env file.')
      return
    }

    try {
      setStatus('testing')
      await generateSpeech('Hello, this is a test.')
      alert('✅ API connection successful! Your credentials are working.')
      setStatus('idle')
    } catch (error) {
      alert(`❌ API test failed: ${error.message}`)
      setStatus('idle')
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0])
  }

  const fetchAvailableVoices = async () => {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': API_KEY,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`)
      }

      const data = await response.json()
      return data.voices || []
    } catch (error) {
      console.error('Error fetching voices:', error)
      throw error
    }
  }

  const showAvailableVoices = async () => {
    try {
      const voices = await fetchAvailableVoices()
      const voiceList = voices
        .map((voice) => `${voice.name} (ID: ${voice.voice_id})`)
        .join('\n')

      alert(
        `Available voices:\n\n${voiceList}\n\nCopy a voice ID to use in your .env file.`,
      )
    } catch (error) {
      alert(`Failed to fetch voices: ${error.message}`)
    }
  }

  const generateSpeech = async (text) => {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=wav_32000`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/wav',
          'Content-Type': 'application/json',
          'xi-api-key': API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          language_code: 'uk',
          voice_settings: {
            speed: 1.0,
            stability: 0.75,
            similarity_boost: 1,
            use_speaker_boost: true,
          },
        }),
      },
    )

    if (!response.ok) {
      let errorMessage = `ElevenLabs API error: ${response.status}`

      // Provide specific error messages for common status codes
      switch (response.status) {
        case 401:
          errorMessage =
            'Invalid API key. Please check your ElevenLabs API key.'
          break
        case 402:
          errorMessage =
            'Payment required. Please check your ElevenLabs account balance and billing status.'
          break
        case 429:
          errorMessage =
            'Rate limit exceeded. Please wait before making more requests.'
          break
        case 422:
          errorMessage =
            'Invalid request parameters. Please check your voice ID and text content.'
          break
        case 404:
          errorMessage =
            'Voice not found (404). The specified voice ID may not exist or may require a paid subscription. Please check your available voices.'
          break
        default:
          errorMessage = `ElevenLabs API error: ${response.status} - ${response.statusText}`
      }

      throw new Error(errorMessage)
    }

    return await response.blob()
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
      const rows = rawData.slice(1) // Skip header row

      console.log('Raw Excel data (first 5 rows):', rawData.slice(0, 5))
      console.log('Total rows found (excluding header):', rows.length)

      setProgress({current: 0, total: rows.length})

      let processedCount = 0

      // 3. Process Rows Sequentially
      for (let i = 0; i < rows.length; i++) {
        const [fileName, text] = rows[i]
        console.log(`Processing row ${i + 1}:`, {fileName, text})

        if (!text || text.toString().trim() === '') {
          console.log(`Skipping row ${i + 1} - no text content`)
          continue
        }

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

      saveAs(finalZip, `IVR_Voice_Pack_${new Date().toLocaleDateString()}.zip`)
      setStatus('complete')
    } catch (error) {
      console.error('TTS Error:', error)
      alert('Error during generation. Check your API key and Voice ID.')
      setStatus('idle')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-xl border-none shadow-xl">
        <CardHeader className="border-b pb-6 text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
            <FileAudio className="h-8 w-8 text-accent-foreground" />
            Voice Pack Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-8">
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
            disabled={status === 'processing' || status === 'testing' || !file}
            onClick={startBulkGeneration}
          >
            {status === 'processing' ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Processing{' '}
                {progress.current}/{progress.total}
              </>
            ) : status === 'complete' ? (
              <>
                <Download className="mr-2 h-6 w-6" /> Re-download Pack
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
  )
}
