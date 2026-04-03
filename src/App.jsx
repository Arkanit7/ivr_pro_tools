import {useState} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import Excel from '@/components/Excel'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Excel />
    </>
  )
}

export default App
