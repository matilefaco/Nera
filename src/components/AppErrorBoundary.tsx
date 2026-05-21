import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { runtimeLogger } from '../lib/runtimeDiagnostics';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  private handleWindowError = (event: ErrorEvent) => {
    runtimeLogger.log('error', { type: 'window_error', message: event.message });
    if (this.isFirestoreError(event.error || event.message)) {
      runtimeLogger.dump();
      event.preventDefault(); // Prevent default browser console error
      this.setState({ hasError: true, error: event.error || new Error(event.message) });
    }
  };

  private handlePromiseRejection = (event: PromiseRejectionEvent) => {
    runtimeLogger.log('error', { type: 'promise_rejection', reason: event.reason });
    if (this.isFirestoreError(event.reason)) {
      runtimeLogger.dump();
      event.preventDefault();
      // Não crashar globalmente por erro assíncrono do Firestore
    }
  };

  private isFirestoreError = (error: any): boolean => {
    const msg = error?.message || String(error);
    return msg.includes('FIRESTORE') || 
           msg.includes('INTERNAL ASSERTION FAILED') ||
           msg.includes('Unexpected state');
  };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    runtimeLogger.log('error', { type: 'react_boundary', message: error.message, stack: error.stack });
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
    if (this.isFirestoreError(error)) {
        runtimeLogger.dump();
    }
  }

  private handleReload = () => {
    // Optional: selectively clear problematic state here before reloading
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const isFirestoreError = this.state.error?.message?.includes('FIRESTORE') || 
                               this.state.error?.message?.includes('INTERNAL ASSERTION FAILED') ||
                               this.state.error?.message?.includes('Unexpected state');

      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-sand/30 p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-brand-sand/50 text-center relative overflow-hidden">
            {/* Subtle top accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-brand-terracotta to-brand-peach"></div>
            
            <div className="w-16 h-16 bg-brand-rose/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-terracotta">
              <AlertCircle size={32} />
            </div>
            
            <h1 className="text-2xl font-serif text-brand-ink mb-3">
              Algo saiu do ritmo por um instante.
            </h1>
            
            <p className="text-brand-stone text-sm mb-8">
              Recarregue a página para continuar usando a Nera. Isso ajuda a sincronizar as informações mais recentes.
            </p>
            
            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 py-4 bg-brand-ink text-white rounded-2xl font-bold uppercase tracking-widest text-[11px] hover:bg-brand-ink/90 transition-all active:scale-95"
            >
              <RefreshCw size={16} />
              Recarregar com segurança
            </button>
            
            {/* Soft subtle pattern in background */}
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-brand-peach/20 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-sand/50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
