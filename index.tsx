import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import App from './App.tsx';

// Initialize Sentry for error tracking
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 0.1,
  environment: import.meta.env.MODE,
  beforeSend(event) {
    // Sanitizar dados sensíveis antes de enviar para o Sentry
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.stacktrace) {
        error.stacktrace.frames.forEach(frame => {
          if (frame.vars) {
            // Remover potenciais secrets de variáveis capturadas
            delete frame.vars['SUPABASE_SERVICE_ROLE_KEY'];
            delete frame.vars['GEMINI_API_KEY'];
            delete frame.vars['CRON_SECRET'];
          }
        });
      }
    }
    return event;
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Não foi possível encontrar o elemento root para montar a aplicação");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);