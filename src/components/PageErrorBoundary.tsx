import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  title?: string;
  message?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PageErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    if (this.props.onRetry) {
      this.setState({ hasError: false, error: null }, () => {
        this.props.onRetry!();
      });
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center bg-brand-white rounded-3xl border border-brand-mist/50 mt-6 md:mt-12 mx-auto max-w-2xl">
          <div className="w-16 h-16 bg-brand-linen rounded-full flex items-center justify-center mb-6 text-brand-ink/40">
            <AlertCircle className="w-8 h-8" />
          </div>
          
          <h2 className="text-xl font-serif text-brand-ink mb-2">
            {this.props.title || "Não foi possível carregar esta área."}
          </h2>
          
          <p className="text-brand-stone mb-8 max-w-sm mx-auto text-sm font-light">
            {this.props.message || "Tivemos um contratempo. Recarregar costuma resolver."}
          </p>

          <button 
            onClick={this.handleRetry}
            className="flex items-center gap-2 rounded-full font-medium px-6 py-3 border border-brand-mist hover:bg-brand-mist/20 text-brand-ink transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Recarregar área
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
