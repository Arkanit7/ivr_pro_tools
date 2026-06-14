import router from './router'
import {RouterProvider} from 'react-router'
import {ThemeProvider} from '@/context/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default App
