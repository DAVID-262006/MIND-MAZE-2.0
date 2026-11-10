import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw, RefreshCw, Terminal, ChevronDown, ChevronUp, Compass, Shield } from 'lucide-react';
import { Button } from './Button';
import { StorageService } from '../../services/storageService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  boundaryName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  showDiagnostics: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    showDiagnostics: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDiagnostics: false };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.boundaryName || 'Root'}] Caught exception:`, error);
    console.error('Component stack trace:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    // Attempt re-render without page reload
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleResetStorage = () => {
    if (window.confirm('Reset all local game state and rehydrate with fresh tournament seed data?')) {
      StorageService.clearAll();
      window.location.hash = '/player';
      window.location.reload();
    }
  };

  private handleNavigatePlayer = () => {
    window.location.hash = '/player';
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleNavigateAdmin = () => {
    window.location.hash = '/admin';
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDiagnostics } = this.state;
      const errorMessage = error?.message || 'An unexpected runtime error occurred.';
      const errorStack = error?.stack || '';
      const componentStack = errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen bg-arena-bg flex flex-col justify-center items-center p-4 select-none">
          <div className="w-full max-w-xl bg-arena-card border-2 border-electric-crimson/50 rounded-2xl p-5 sm:p-7 shadow-[0_0_40px_rgba(239,68,68,0.25)] space-y-5 animate-in fade-in duration-200">
            {/* Header Icon & Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-red-500/10 border border-electric-crimson/30 rounded-2xl text-electric-crimson mb-1 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <AlertOctagon className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                RUNTIME ANOMALY DETECTED
              </h2>
              <p className="text-xs text-arena-muted max-w-md mx-auto leading-relaxed">
                The application encountered an unexpected state. Your local event data and team progress are safely preserved in storage.
              </p>
            </div>

            {/* Error Message Box */}
            <div className="p-3.5 bg-arena-panel rounded-xl border border-electric-crimson/30 text-xs font-mono text-electric-crimson space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-arena-muted block">
                Exception Diagnostic:
              </span>
              <p className="font-semibold break-words">{errorMessage}</p>
            </div>

            {/* Recovery Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <Button
                variant="primary"
                className="w-full h-11 text-xs font-mono font-bold"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={this.handleRetry}
              >
                Retry Interface
              </Button>

              <Button
                variant="outline"
                className="w-full h-11 text-xs font-mono"
                icon={<RefreshCw className="w-4 h-4 text-electric-amber" />}
                onClick={this.handleResetStorage}
              >
                Reset to Clean Seed
              </Button>

              <Button
                variant="ghost"
                className="w-full h-10 text-xs font-mono text-arena-muted hover:text-white"
                icon={<Compass className="w-4 h-4 text-electric-cyan" />}
                onClick={this.handleNavigatePlayer}
              >
                Go to Player Arena
              </Button>

              <Button
                variant="ghost"
                className="w-full h-10 text-xs font-mono text-arena-muted hover:text-white"
                icon={<Shield className="w-4 h-4 text-electric-violet" />}
                onClick={this.handleNavigateAdmin}
              >
                Go to Admin Control
              </Button>
            </div>

            {/* Collapsible Technical Stack Trace */}
            <div className="pt-2 border-t border-arena-border">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDiagnostics: !prev.showDiagnostics }))}
                className="w-full flex items-center justify-between text-xs font-mono text-arena-muted hover:text-white py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-electric-cyan" />
                  <span>Technical Diagnostics &amp; Stack Trace</span>
                </span>
                {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDiagnostics && (
                <div className="mt-2 p-3 bg-black/60 rounded-lg border border-arena-border overflow-x-auto max-h-48 text-[11px] font-mono text-arena-muted space-y-2 select-text">
                  <div>
                    <strong className="text-white block">Error Stack:</strong>
                    <pre className="whitespace-pre-wrap break-all text-[10px] text-red-400 mt-0.5">
                      {errorStack || 'No stack trace available.'}
                    </pre>
                  </div>
                  {componentStack && (
                    <div className="pt-2 border-t border-arena-border/40">
                      <strong className="text-white block">Component Hierarchy:</strong>
                      <pre className="whitespace-pre-wrap break-all text-[10px] text-arena-muted mt-0.5">
                        {componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
