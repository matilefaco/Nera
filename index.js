import { onRequest } from 'firebase-functions/v2/https';

let cachedApp = null;

async function getApp() {
  if (!cachedApp) {
    const { createServerApp } = await import('./dist-server/server.js');
    cachedApp = await createServerApp();
  }
  return cachedApp;
}

export const api = onRequest(
  {
    region: 'us-east1',
    memory: '512MiB',
    timeoutSeconds: 60,
    minInstances: 0,
    cors: true,
  },
  async (req, res) => {
    const rawUrl = String(req.url || req.originalUrl || '');
    const blockedDebugTerms = [
      'debug',
      'test-email',
      'test-whatsapp',
      'test-ai-service-description',
      'fix-duplicate-slots',
      'run-confirmation-email',
    ];

    if (blockedDebugTerms.some((term) => rawUrl.includes(term))) {
      return res.status(404).send('Not Found');
    }

    try {
      const app = await getApp();
      return app(req, res);
    } catch (err) {
      console.error('[CRITICAL STARTUP ERROR]', err);
      return res.status(500).send('Internal Server Error during initialization');
    }
  }
);
