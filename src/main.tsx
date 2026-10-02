import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { SecurityProvider } from './contexts/SecurityContext';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Crash Caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '2.5rem',
            maxWidth: '520px',
            margin: '4rem auto',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '1.25rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            color: '#0f172a',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h2 style={{ color: '#e11d48', fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Terjadi Kendala pada Tampilan
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem', wordBreak: 'break-word' }}>
            {this.state.error?.message || 'Error rendering tidak diketahui.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.65rem 1.5rem',
              backgroundColor: '#f59e0b',
              color: '#0f172a',
              fontWeight: 800,
              border: 'none',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            Muat Ulang Aplikasi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SecurityProvider>
        <PrivacyProvider>
          <App />
        </PrivacyProvider>
      </SecurityProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
