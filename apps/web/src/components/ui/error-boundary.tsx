"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Intentionally not logging to console per AGENTS.md (no console.log/error).
    // Error boundary catches render-time crashes only.
    // Production error tracking can be added here later if needed.
    void error;
    void errorInfo;
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
            <p className="text-lg font-medium text-foreground">
              Something went wrong
            </p>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please try reloading the page.
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
