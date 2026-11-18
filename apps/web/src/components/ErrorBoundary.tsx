import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-fb-surface border border-white/10 rounded-2xl p-6 text-center shadow-xl">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {this.props.fallbackTitle || 'Đã xảy ra sự cố hiển thị'}
            </h3>
            <p className="text-sm text-fb-text-muted mb-6">
              Hệ thống đã tự động bảo vệ để tránh treo trình duyệt. Bạn có thể thử tải lại trang hoặc quay lại sau.
            </p>
            {this.state.error && (
              <div className="text-left bg-black/40 border border-white/5 rounded-xl p-3 mb-6 max-h-32 overflow-y-auto font-mono text-xs text-red-400">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-md flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                Tải lại trang
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="px-4 py-2 rounded-xl bg-fb-surface-hover hover:bg-white/10 text-fb-text-muted hover:text-white text-sm font-semibold transition-all border border-white/10 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">home</span>
                Về Trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
