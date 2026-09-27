import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { SecurityProvider } from './contexts/SecurityContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SecurityProvider>
      <PrivacyProvider>
        <App />
      </PrivacyProvider>
    </SecurityProvider>
  </React.StrictMode>
);
