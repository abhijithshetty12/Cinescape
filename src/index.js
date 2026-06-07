import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext.tsx';

// PWA: register custom service worker for offline caching + background sync hooks
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch(() => {
        // ignore (e.g., unsupported browsers)
      });
  });
}

// When connectivity returns, ask the service worker to flush queued watchlist ops.
window.addEventListener('online', async () => {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: 'WATCHLIST_FLUSH' });
    }
  } catch {
    // ignore
  }
});


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);


