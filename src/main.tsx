import { StrictMode, type ReactNode } from 'react';
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

try {
  const strictModeEnabled = import.meta.env.VITE_ENABLE_STRICT_MODE !== 'false';
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found in DOM');
  }

  const appTree: ReactNode = strictModeEnabled ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  );

  createRoot(rootElement).render(appTree);
} catch (err) {
  console.error('[BOOT_FAILURE]', err);
  const debug = document.createElement('div');
  debug.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:red;color:white;padding:50px;z-index:999999;font-family:monospace;';
  debug.innerHTML = `<h1>FALHA CRÍTICA NA INICIALIZAÇÃO</h1><pre>${err instanceof Error ? err.stack : String(err)}</pre>`;
  document.body ? document.body.appendChild(debug) : document.documentElement.appendChild(debug);
}
