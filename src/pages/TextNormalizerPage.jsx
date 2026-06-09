import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Copy, Check, FileText, Trash2} from 'lucide-react'
import normalizeForTTS from '@/lib/normalizeForTTS'

export default function TextNormalizerPage() {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [copied, setCopied] = useState(false)

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
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <Card className="w-full max-w-4xl border-none shadow-xl">
        <CardHeader className="border-b pb-6 text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
            <FileText className="h-8 w-8 text-blue-500" />
            Нормалізатор тексту
          </CardTitle>
          <CardDescription>
            Перетворює сирий текст промпта у формат, придатний для TTS
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="input-text">Вихідний текст</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {inputText.length} симв.
                </span>
              </div>
              <Textarea
                id="input-text"
                placeholder="Вставте вихідний текст тут..."
                value={inputText}
                onChange={handleInputChange}
                className="min-h-75 resize-y"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="output-text">Нормалізований текст</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {outputText.length} симв.
                </span>
              </div>
              <Textarea
                id="output-text"
                placeholder="Нормалізований текст з'явиться тут..."
                value={outputText}
                readOnly
                className="min-h-75 resize-y bg-muted/50 text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Button
              onClick={handleClear}
              variant="outline"
              disabled={!inputText}
              className="px-6"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Очистити
            </Button>
            <Button
              onClick={handleCopy}
              disabled={!outputText}
              className="px-6"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Скопійовано!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Скопіювати
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
