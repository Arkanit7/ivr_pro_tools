import {Upload} from 'lucide-react'

export default function FileUpload({
  file,
  onFileChange,
  defaultText = 'Select IVR Script (Excel)',
  instructionText = 'Col A: Filename | Col B: Script Text',
}) {
  return (
    <div className="group relative">
      <input
        type="file"
        accept=".xlsx, .xls"
        className="hidden"
        id="excel-upload"
        onChange={onFileChange}
      />
      <label
        htmlFor="excel-upload"
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card py-10 transition-all hover:border-muted-foreground hover:bg-muted"
      >
        <Upload className="mb-2 h-10 w-10 group-hover:text-accent-foreground" />
        <span className="text-sm font-semibold">
          {file ? file.name : defaultText}
        </span>
        <span className="mt-1 text-xs text-muted-foreground italic">
          {instructionText}
        </span>
      </label>
    </div>
  )
}
