import {defineConfig} from 'vite'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import {viteSingleFile} from 'vite-plugin-singlefile'

/** @see https://vite.dev/config/ */
export default defineConfig({
  server: {
    open: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    react(),
    babel({presets: [reactCompilerPreset()]}),
    tailwindcss(),
    viteSingleFile({removeViteModuleLoader: true}),
  ],
  base: './',
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    rollupOptions: {
      cssCodeSplit: false,
    },
  },
  define: {
    global: 'globalThis',
  },
})
