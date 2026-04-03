import React, {useState} from 'react'
import * as XLSX from 'xlsx'
import {Button} from '@/components/ui/button' // Assuming Shadcn
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Upload, Download, FileJson} from 'lucide-react'
import ttsNormalize from '@/lib/ttsNormalize'

export default function ExcelModifier() {
  const [fileName, setFileName] = useState('')

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)

    // 1. Read the file into an ArrayBuffer
    const data = await file.arrayBuffer()

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
        row[keys[1]] = ttsNormalize(row[keys[1]])
      }
      return row
    })

    // Create a new worksheet from the modified JSON
    const newWorksheet = XLSX.utils.json_to_sheet(modifiedData)
    const newWorkbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'ModifiedSheet')

    // 5. Spit the file back out (Download)
    XLSX.writeFile(newWorkbook, `modified_${file.name}`)
  }

  return (
    <Card className="mx-auto mt-10 w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="text-green-600" />
          Excel Text Modifier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-slate-50 p-6">
          <input
            type="file"
            id="excel-input"
            className="hidden"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
          />
          <label
            htmlFor="excel-input"
            className="flex cursor-pointer flex-col items-center"
          >
            <Upload className="mb-2 h-8 w-8 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">
              {fileName || 'Click to upload Excel'}
            </span>
          </label>
        </div>
        <p className="text-center text-xs text-slate-500">
          The modified file will download automatically once processed.
        </p>
      </CardContent>
    </Card>
  )
}
