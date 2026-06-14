import {useState, useId} from 'react'
import {Upload} from 'lucide-react'
import {cn} from '@/lib/utils'

export default function FileUpload({
  file,
  onFileChange,
  defaultText = 'Оберіть IVR скрипт (Excel)',
  instructionText = 'Стовп A: Назва файлу | Стовп B: Текст скрипту',
}) {
  const id = useId()
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) {
      onFileChange({target: {files: e.dataTransfer.files}})
    }
  }

  return (
    <div className="group relative">
      <input
        type="file"
        accept=".xlsx, .xls"
        className="hidden"
        id={id}
        onChange={onFileChange}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 transition-all',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card hover:border-muted-foreground hover:bg-muted',
        )}
      >
        <Upload
          className={cn(
            'mb-2 h-10 w-10',
            isDragging ? 'text-primary' : 'group-hover:text-accent-foreground',
          )}
        />
        <span className="text-sm font-semibold">{file ? file.name : defaultText}</span>
        <span className="mt-1 text-xs italic text-muted-foreground">{instructionText}</span>
      </label>
    </div>
  )
}
