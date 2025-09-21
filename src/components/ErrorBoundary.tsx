import React from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Log with as much useful detail as possible
    console.error('UI ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const message =
        typeof this.state.error === 'string'
          ? this.state.error
          : this.state.error?.message || 'Unexpected rendering error';

      return (
        <div className="container mx-auto px-4 py-10">
          <div className="mx-auto max-w-2xl rounded-md border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h2 className="text-lg font-semibold text-red-900">A runtime error occurred</h2>
                <p className="mt-1 text-sm text-red-800 break-all">{message}</p>
                {this.state.error?.stack && (
                  <details className="mt-3 whitespace-pre-wrap break-all text-xs text-red-700">
                    <summary>Stack trace</summary>
                    {String(this.state.error.stack)}
                  </details>
                )}
                <button
                  className="mt-4 inline-flex items-center rounded-md border px-3 py-1 text-sm"
                  onClick={() => window.location.reload()}
                >
                  Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

