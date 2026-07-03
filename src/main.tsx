import "./instrument";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

console.log('[main.tsx] Execution started');

// Global error logger - only verbose in non-production
const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('ais-dev');

window.addEventListener('error', (event) => {
  if (isDev) {
    console.error('[MAIN_ERROR]', event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (isDev) {
    console.error('[PROMISE_ERROR]', reason);
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[main.tsx] Root element not found!');
  throw new Error('Root element not found in DOM');
}

console.log('[main.tsx] Root element found, mounting...');
try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log('[main.tsx] Render called successfully');
} catch (e) {
  console.error('[main.tsx] Mounting error:', e);
}
