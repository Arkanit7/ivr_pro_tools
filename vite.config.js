import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import {viteSingleFile} from 'vite-plugin-singlefile'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @see https://vite.dev/config/ */
export default defineConfig({
  server: {
    open: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    babel({presets: [reactCompilerPreset()]}),
    tailwindcss(),
    viteSingleFile(),
  ],
  base: './',
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    // rollupOptions: {
    //   inlineDynamicImports: true,
    // },
  },
  define: {
    global: 'globalThis',
  },
})
