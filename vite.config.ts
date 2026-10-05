import { defineConfig } from 'vite'
import { resolve } from 'path'
import { devSavePlugin } from './scripts/dev-save-plugin'

export default defineConfig({
  plugins: [devSavePlugin()],
  base: '/opengamebooks/',
  build: {
    rollupOptions: {
      input: {
        app:    resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
  },
})
