import {useState} from 'react'
import * as XLSX from 'xlsx'
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card'
import {FileSpreadsheet} from 'lucide-react'
import {PageShell} from '@/components/PageShell'
import FileUpload from '@/components/FileUpload'
import normalizeForTTS from '@/lib/normalizeForTTS'

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

    const data = await selectedFile.arrayBuffer()
    const workbook = XLSX.read(data)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    const modifiedData = jsonData.map((row) => {
      const keys = Object.keys(row)
      if (keys.length >= 2 && row[keys[1]] !== undefined) {
        row[keys[1]] = normalizeForTTS(row[keys[1]])
      }
      return row
    })

    const newWorksheet = XLSX.utils.json_to_sheet(modifiedData)
    const newWorkbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'ModifiedSheet')
    const ext = selectedFile.name.match(/\.[^.]+$/)?.[0] ?? '.xlsx'
    const baseName = selectedFile.name.replace(/\.[^.]+$/, '')
    XLSX.writeFile(newWorkbook, `${baseName}_${formatDate()}${ext}`)
  }

  return (
    <PageShell>
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="border-b pb-6 text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            Нормалізатор Excel
          </CardTitle>
          <CardDescription>
            Нормалізує другий стовпець Excel-файлу для TTS та завантажує результат автоматично
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-6 space-y-4">
          <FileUpload
            file={file}
            onFileChange={handleFileChange}
            defaultText="Завантажте Excel файл"
            instructionText="Стовп A: Назва файлу | Стовп B: Текст (буде нормалізовано)"
          />
        </CardContent>
      </Card>
    </PageShell>
  )
}
