import {useState} from 'react'
import {ExcelWriter, downloadXlsx} from 'excel-bridge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {FileSpreadsheet} from 'lucide-react'
import {PageShell} from '@/components/PageShell'
import FileUpload from '@/components/FileUpload'
import normalizeForTTS from '@/lib/normalizeForTTS'
import readFirstSheetRows from '@/lib/readFirstSheetRows'

const formatDate = () => {
  const now = new Date()
  const dateStr = now.toLocaleDateString('uk-UA')
  const timeStr = now.toLocaleTimeString('uk-UA')
  return `${dateStr}_${timeStr.replace(/:/g, '.')}`
}

export default function ExcelNormalizerPage() {
  const [file, setFile] = useState(null)

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    if (!selectedFile) return

    try {
      const [header = [], ...rows] = await readFirstSheetRows(selectedFile)
      const modifiedRows = rows.map((row) => {
        if (row[1] != null) row[1] = normalizeForTTS(row[1])
        return row
      })

      const blob = new ExcelWriter().createWorkbook([
        {data: [header, ...modifiedRows], options: {name: 'ModifiedSheet'}},
      ])
      const baseName = selectedFile.name.replace(/\.[^.]+$/, '')
      downloadXlsx(blob, `${baseName}_${formatDate()}.xlsx`)
    } catch (error) {
      console.error('Error processing Excel file:', error)
      alert('Не вдалося обробити файл. Підтримуються лише файли .xlsx.')
    }
  }

  return (
    <PageShell>
      <Card className="w-full max-w-md border-none bg-transparent shadow-xl">
        <CardHeader className="border-b pb-6 text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            Нормалізатор Excel
          </CardTitle>
          <CardDescription>
            Нормалізує другий стовпець Excel-файлу для TTS та завантажує
            результат автоматично
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-6 space-y-4">
          <FileUpload
            file={file}
            onFileChange={handleFileChange}
            defaultText="Завантажте Excel файл"
            instructionText="Стовпець A: Назва промпта | Стовпець B: Текст промпта (буде нормалізовано)"
          />
        </CardContent>
      </Card>
    </PageShell>
  )
}
