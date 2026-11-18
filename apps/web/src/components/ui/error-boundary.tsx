"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logger";
import { useTranslation } from "react-i18next";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
      <p className="text-lg font-medium text-foreground">
        {t("common.errorBoundary.title")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("common.errorBoundary.description")}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onRetry}>
          {t("common.actions.tryAgain")}
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t("common.actions.reloadPage")}
        </Button>
      </div>
    </div>
  );
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
    logError(error, "React ErrorBoundary caught render error", {
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? <ErrorFallback onRetry={this.handleRetry} />
      );
    }
    return this.props.children;
  }
}
