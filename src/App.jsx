import {useState} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import Excel from '@/components/Excel'
import ElevenLabsBulkProcessor from '@/components/ElevenLabsBulkProcessor'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="min-h-dvh overflow-clip">
        {/* <Excel /> */}
        <main className="pt-4 pb-10">
          <ElevenLabsBulkProcessor />
        </main>
      </div>
    </>
  )
}

export default App
