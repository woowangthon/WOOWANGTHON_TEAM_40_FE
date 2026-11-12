import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
// 팀원 화면용 예전 스타일. vite.config.ts 가 legacy 영역 안에서만 적용되게 감싼다.
import './styles.css'
import './design.css'
import App from './App'
import { AuthProvider } from './auth'
import { ThemeProvider } from './ui'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
