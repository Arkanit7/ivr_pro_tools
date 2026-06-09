import {useState} from 'react'
import * as XLSX from 'xlsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {FileSpreadsheet} from 'lucide-react'
import FileUpload from '@/components/FileUpload'
import normalizeForTTS from '@/lib/normalizeForTTS'

export default function ExcelNormalizer() {
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
    XLSX.writeFile(newWorkbook, `normalized_${selectedFile.name}`)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="border-b pb-6 text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-2xl font-bold">
            <FileSpreadsheet className="h-8 w-8 text-green-500" />
            Excel Normalizer
          </CardTitle>
          <CardDescription>
            Normalizes the 2nd column of your Excel file for TTS and downloads
            it instantly
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-6 space-y-4">
          <FileUpload
            file={file}
            onFileChange={handleFileChange}
            defaultText="Upload Excel File"
            instructionText="Col A: Filename | Col B: Script Text (will be normalized)"
          />
        </CardContent>
      </Card>
    </div>
  )
}
