import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

// Global error logger for main entry (Production Debug)
window.addEventListener('error', (event) => {
  console.error('[MAIN_ERROR]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason ? String(reason.message || reason) : '';
  if (msg.includes('FIRESTORE') || msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('Unexpected state')) {
    event.preventDefault(); // suppress it locally
    return;
  }
  console.error('[PROMISE_ERROR]', reason);
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
