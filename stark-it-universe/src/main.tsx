import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Production builds are pre-rendered (scripts/prerender.mjs), so the HTML is
// already on the page and React only hydrates it. The dev server renders.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
