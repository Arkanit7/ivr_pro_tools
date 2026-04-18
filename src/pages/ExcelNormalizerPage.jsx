import {useState} from 'react'
import * as XLSX from 'xlsx'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {FileJson} from 'lucide-react'
import FileUpload from '@/components/FileUpload'
import normalizeForTTS from '@/lib/normalizeForTTS'

export default function ExcelNormalizer() {
  const [file, setFile] = useState(null)

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    if (!selectedFile) return

    // 1. Read the file into an ArrayBuffer
    const data = await selectedFile.arrayBuffer()

    // 2. Parse the workbook
    const workbook = XLSX.read(data)

    // 3. Get the first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // 4. MODIFY THE TEXT
    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    const modifiedData = jsonData.map((row) => {
      // Get the keys of the row (column headers)
      const keys = Object.keys(row)
      // If there is a second column (index 1), convert its value to uppercase
      if (keys.length >= 2 && row[keys[1]] !== undefined) {
        row[keys[1]] = normalizeForTTS(row[keys[1]])
      }
      return row
    })

    // Create a new worksheet from the modified JSON
    const newWorksheet = XLSX.utils.json_to_sheet(modifiedData)
    const newWorkbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'ModifiedSheet')

    // 5. Spit the file back out (Download)
    XLSX.writeFile(newWorkbook, `normalized_${selectedFile.name}`)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="text-green-600" />
            Excel Text Normalizer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload
            file={file}
            onFileChange={handleFileChange}
            defaultText="Click to upload Excel"
            instructionText="Only the 2nd column will be normalized for TTS"
          />
          <p className="text-center text-xs text-slate-500">
            Text in the 2nd column will be normalized for text-to-speech and the
            modified file will download automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
