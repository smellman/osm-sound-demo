import { defineConfig } from 'vite'
export default defineConfig({
  base: '/osm-sound-demo/',
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: [
          'import',
          'color-functions',
          'global-builtin',
          'if-function',
        ],
      },
    },
  },
  server: {
    host: true,
  },
})