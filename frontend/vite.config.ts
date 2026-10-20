import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import { SITE_CONFIG } from './src/config/site'

// 后端服务地址
const BACKEND_URL = 'http://localhost:8081'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'site-html-config',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        const values: Record<string, string> = {
          SITE_AUTHOR: `${SITE_CONFIG.author}（${SITE_CONFIG.authorAlias}）`,
          SITE_DESCRIPTION: SITE_CONFIG.description,
          SITE_TITLE: SITE_CONFIG.homeTitle,
        }
        const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        })[character]!)
        return html.replace(/%(SITE_AUTHOR|SITE_DESCRIPTION|SITE_TITLE)%/g, (_, key: string) => escapeHtml(values[key]))
      },
    },
  }],
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
