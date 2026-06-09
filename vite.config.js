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
    viteSingleFile(),
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    global: 'globalThis',
  },
})
