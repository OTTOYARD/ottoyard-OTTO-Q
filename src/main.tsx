import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { captureTwinLink } from './lib/twin/twinLink'
import { captureAgentLink } from './lib/agentLink'

// Read a twin link (?source=twin&run=…) before sign-in can redirect and drop the query string.
captureTwinLink()
// And an owner's agent's receipt link (?source=agent&owner=…&command=…). After the twin link: opened from a receipt,
// the cockpit stops following a twin run an earlier link in this tab pinned.
captureAgentLink()

createRoot(document.getElementById("root")!).render(<App />);
