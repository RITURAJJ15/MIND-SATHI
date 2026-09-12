import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class VoiceErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('VoiceErrorBoundary caught an error in voice assistant:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 my-4 text-amber-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎙️</span>
            <div className="flex-1">
              <p className="font-medium text-sm text-amber-300">
                Voice service is temporarily unavailable.
              </p>
              <p className="text-xs text-amber-300/70 mt-0.5">
                You can continue using MIND SATHI normally.
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-amber-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VoiceErrorBoundary;
