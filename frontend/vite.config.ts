import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

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
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      // 服务器文档目录中的图片/附件
      '/docs-static': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => '/api' + path,
      },
    },
  },
})
