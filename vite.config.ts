import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 중에는 /api 요청을 FastAPI 서버로 넘긴다. 배포에서는 FastAPI가 빌드 결과를 같이 서비스한다.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
