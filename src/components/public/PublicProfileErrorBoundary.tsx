import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PublicProfileErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PublicProfileErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (this as any).props.fallback || (
        <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
          <h2 className="text-xl font-serif text-brand-espresso mb-4">Ops! Algo deu errado ao carregar o perfil.</h2>
          <p className="text-brand-stone mb-8 max-w-md">Ocorreu um erro inesperado no navegador. Tente recarregar a página ou voltar mais tarde.</p>
          {import.meta.env.DEV && (
            <pre className="text-xs bg-red-100 p-4 rounded text-left overflow-auto max-w-full">
              {this.state.error?.message}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-brand-terracotta text-white rounded-full hover:bg-brand-sienna transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
