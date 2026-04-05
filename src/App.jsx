import {useState} from 'react'
import ExcelNormalizer from '@/components/ExcelNormalizer'
import ElevenLabsBulkProcessor from '@/components/ElevenLabsBulkProcessor'
import TextNormalizer from '@/components/TextNormalizer'
import {Button} from '@/components/ui/button'
import {FileSpreadsheet, FileAudio, FileText} from 'lucide-react'

function App() {
  const [currentView, setCurrentView] = useState('text') // 'excel', 'text', or 'tts'

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-background p-4">
        <div className="space-y-2">
          <Button
            variant={currentView === 'text' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setCurrentView('text')}
          >
            <FileText className="mr-2 h-4 w-4" />
            Text Normalizer
          </Button>
          <Button
            variant={currentView === 'excel' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setCurrentView('excel')}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel Text Normalizer
          </Button>
          <Button
            variant={currentView === 'tts' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => setCurrentView('tts')}
          >
            <FileAudio className="mr-2 h-4 w-4" />
            Excel to Voice
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {currentView === 'excel' ? (
          <ExcelNormalizer />
        ) : currentView === 'text' ? (
          <TextNormalizer />
        ) : (
          <ElevenLabsBulkProcessor />
        )}
      </div>
    </div>
  )
}

export default App
