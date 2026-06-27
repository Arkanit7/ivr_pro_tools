import router from './router'
import {RouterProvider} from 'react-router'
import {ThemeProvider} from '@/context/ThemeContext'
import {AccentProvider} from '@/context/AccentContext'

function App() {
  return (
    <ThemeProvider>
      <AccentProvider>
        <RouterProvider router={router} />
      </AccentProvider>
    </ThemeProvider>
  )
}

export default App
