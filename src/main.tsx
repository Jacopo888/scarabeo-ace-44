import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import App from './App.tsx'
import { useGameStore } from '@/store/game'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light">
    <App />
  </ThemeProvider>
);

if (import.meta.env.DEV) {
  import('zustand/middleware').then(({ devtools }) => {
    // Dev tools are already attached via the devtools middleware in the store
  })
}
