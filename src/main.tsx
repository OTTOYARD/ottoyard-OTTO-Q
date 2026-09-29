import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { captureTwinLink } from './lib/twin/twinLink'

// Read a twin link (?source=twin&run=…) before sign-in can redirect and drop the query string.
captureTwinLink()

createRoot(document.getElementById("root")!).render(<App />);
