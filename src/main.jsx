import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import { publicRoute } from './public/routes'

// Public pages (src/public) are prerendered to HTML at build time and use a
// small bundle of their own; everything else is the app, loaded on demand so
// visitors to the public pages never download it.
const root = document.getElementById('root')
const path = window.location.pathname

if (publicRoute(path) || document.documentElement.dataset.page === '404') {
  import('./public/PublicApp.jsx').then((mod) => {
    const PublicApp = mod.default
    const tree = <StrictMode><PublicApp pathname={document.documentElement.dataset.page === '404' ? '/404' : path} /></StrictMode>
    // the prerendered HTML is already in #root (built site); in dev it is empty
    if (root.firstElementChild) hydrateRoot(root, tree)
    else createRoot(root).render(tree)
  })
} else {
  import('./App.jsx').then((mod) => {
    const App = mod.default
    createRoot(root).render(<StrictMode><App /></StrictMode>)
  })
}
