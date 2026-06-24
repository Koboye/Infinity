'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  fallback?: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render-time errors anywhere in the
 * descendant tree and lets us show a recovery UI instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production this would forward to Sentry/Datadog. We just log here.
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-6xl">😵</div>
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="max-w-md text-sm text-white/50">
          {error.message || 'An unexpected error occurred while rendering this view.'}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="gradient-brand rounded-2xl px-6 py-3 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }
}
