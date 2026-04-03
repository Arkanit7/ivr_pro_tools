import {useState} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1 className="text-xl">IVR PRO Tools</h1>
      <input
        className="cursor-pointer rounded-lg bg-zinc-950 text-white"
        type="file"
        name="excel"
      />
    </>
  )
}

export default App
