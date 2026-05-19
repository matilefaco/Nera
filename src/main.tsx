import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

// Global error logger - only verbose in non-production
const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('ais-dev');

window.addEventListener('error', (event) => {
  if (isDev) {
    console.error('[MAIN_ERROR]', event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason ? String(reason.message || reason) : '';
  if (msg.includes('FIRESTORE') || msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('Unexpected state')) {
    event.preventDefault(); // suppress it locally
    return;
  }
  if (isDev) {
    console.error('[PROMISE_ERROR]', reason);
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found in DOM');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
