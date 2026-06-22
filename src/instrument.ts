import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  // Tracing
  tracesSampleRate: import.meta.env.MODE === "development" ? 1.0 : 0.1,
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/usenera\.com\/api/,
    /^https:\/\/.*\.cloudfunctions\.net/
  ],
});
