import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// NOTE: React.StrictMode is intentionally omitted. React Flow (@xyflow/react)
// has a known conflict with StrictMode's dev-only double-invocation — its
// controlled-node measurement re-syncs during commit, which React 19 flags with
// "Cannot update a component while rendering" / "deps array changed size"
// warnings. The app logic is StrictMode-safe regardless (e.g. seeding is guarded
// by a module-level promise in db/seed.ts).
createRoot(document.getElementById('root')!).render(<App />)
