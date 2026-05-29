import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'
// Vite + React なので /react サブパス。/next は Next.js 専用なので機能しない。
import { Analytics } from '@vercel/analytics/react'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {/* Vercel が自動でスクリプトを差し込んでページビューを記録する。
        本番ビルド時のみ動作する (dev では console に "Vercel Web
        Analytics Debug mode" と出るだけで送信はされない)。 */}
    <Analytics />
  </React.StrictMode>
)
