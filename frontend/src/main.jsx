import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans/wght.css'
import '@fontsource-variable/plus-jakarta-sans/wght-italic.css'
import '@fontsource/fredoka/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import './index.css'
import App from './App.jsx'
import { refreshBrand } from './state/brand'

refreshBrand() // logo & nama aplikasi (Admin > Tampilan); yang tersimpan terakhir langsung dipakai selagi menunggu

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
