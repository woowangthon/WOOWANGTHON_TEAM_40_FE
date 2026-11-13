import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
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
