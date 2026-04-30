import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register generated PWA service worker and force promptless updates.
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service worker registered:', swUrl);
    registration?.update();
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline.');
  },
  onNeedRefresh() {
    console.log('[PWA] New version found, reloading...');
    window.location.reload();
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
