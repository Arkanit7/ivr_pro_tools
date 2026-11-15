import router from './router'
import {RouterProvider} from 'react-router'
import {ThemeProvider} from '@/context/ThemeContext'
import {AccentProvider} from '@/context/AccentContext'
import {ElevenLabsSettingsProvider} from '@/context/ElevenLabsSettingsContext'

function App() {
  return (
    <ThemeProvider>
      <AccentProvider>
        <ElevenLabsSettingsProvider>
          <RouterProvider router={router} />
        </ElevenLabsSettingsProvider>
      </AccentProvider>
    </ThemeProvider>
  )
}

export default App
