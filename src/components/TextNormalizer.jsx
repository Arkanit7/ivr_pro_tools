import React, {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Copy, FileText, Trash2} from 'lucide-react'
import normalizeForTTS from '@/lib/normalizeForTTS'

export default function TextNormalizer() {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')

  const handleInputChange = (e) => {
    const value = e.target.value
    setInputText(value)
    setOutputText(normalizeForTTS(value))
  }

  const handleClear = () => {
    setInputText('')
    setOutputText('')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText)
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="text-blue-600" />
            Text Normalizer for TTS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="input-text">Raw Text</Label>
              <Textarea
                id="input-text"
                placeholder="Paste your raw text here..."
                value={inputText}
                onChange={handleInputChange}
                className="min-h-75 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="output-text">Normalized Text</Label>
              <Textarea
                id="output-text"
                placeholder="Normalized text will appear here..."
                value={outputText}
                readOnly
                className="min-h-75 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <Button onClick={handleClear} variant="outline" className="px-6">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
            <Button onClick={handleCopy} className="px-6">
              <Copy className="mr-2 h-4 w-4" />
              Copy Normalized
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
