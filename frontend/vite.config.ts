import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

const BACKEND_URL = 'http://localhost:8081'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/robots.txt': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
      },
      '/sitemap.xml': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
      },
      // 服务器文档目录中的图片/附件
      '/docs-static': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
      },
    },
  },
})
