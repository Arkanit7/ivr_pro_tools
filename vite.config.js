import {defineConfig} from 'vite'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

/** @see https://vite.dev/config/ */
export default defineConfig({
  server: {
    open: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [react(), babel({presets: [reactCompilerPreset()]}), tailwindcss()],
  build: {
    target: 'esnext',
  },
  define: {
    global: 'globalThis',
  },
})
