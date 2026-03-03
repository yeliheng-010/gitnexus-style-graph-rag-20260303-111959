import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 允许外部 IP 访问 (相当于 --host)
    host: '0.0.0.0',
    // 配置代理转发
    proxy: {
      // 当前端请求 /api 开头的路径时
      '/api': {
        // 转发给服务器本地的后端服务
        target: 'http://localhost:3000',
        // 修改 Host 头，骗过后端（通常后端不需要，但加了更稳）
        changeOrigin: true,
        // 保持 /api 前缀，因为我们后端路由就是定义为 /api/generate
        // 如果后端是 /generate，这里需要用 rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})