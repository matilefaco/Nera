import "./instrument";
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
