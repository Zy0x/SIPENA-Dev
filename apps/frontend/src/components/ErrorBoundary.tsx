import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={`flex flex-col items-center justify-center p-6 rounded-2xl border border-destructive/20 bg-destructive/5 text-center ${this.props.className || ""}`}>
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {this.props.fallbackTitle || "Terjadi Kesalahan"}
          </h3>
          <p className="text-xs text-muted-foreground mb-3 max-w-xs">
            Bagian ini mengalami error. Coba muat ulang atau hubungi admin jika masalah berlanjut.
          </p>
          {this.state.error && (
            <p className="text-[10px] text-destructive/70 mb-3 font-mono max-w-sm truncate">
              {this.state.error.message}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={this.handleReset} className="text-xs gap-1.5 rounded-xl">
            <RefreshCw className="w-3 h-3" /> Muat Ulang
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
