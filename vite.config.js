import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const root = path.resolve(process.cwd())
  const env = loadEnv(mode, root, '')
  const allowedHosts = [
    '.trycloudflare.com',
    '.cfargotunnel.com',
    '.ngrok-free.app',
    '.ngrok.io',
    '.loca.lt',
  ]
  const custom = (env.DEV_TUNNEL_HOST || '').trim()
  if (custom) allowedHosts.push(custom)

  return {
    logLevel: 'info',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      allowedHosts,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
