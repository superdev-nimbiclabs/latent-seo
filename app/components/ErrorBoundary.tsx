import { Component, type ReactNode } from "react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  Box,
  InlineStack,
} from "@shopify/polaris";
import { captureError } from "../lib/sentry.server";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * React Error Boundary for catching rendering errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);

    // Capture in Sentry (if configured)
    if (typeof window === "undefined") {
      // Server-side
      captureError(error, { action: "react_error_boundary" });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card>
          <Box padding="800">
            <BlockStack gap="400" inlineAlign="center">
              <Text as="h2" variant="headingLg">
                Something went wrong
              </Text>
              <Text as="p" tone="subdued" alignment="center">
                We encountered an unexpected error. Please try refreshing the page.
              </Text>
              {this.state.error && (
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text as="p" variant="bodySm" tone="subdued">
                    Error: {this.state.error.message}
                  </Text>
                </Box>
              )}
              <InlineStack gap="200">
                <Button onClick={this.handleRetry}>
                  Try again
                </Button>
                <Button variant="plain" onClick={() => window.location.reload()}>
                  Refresh page
                </Button>
              </InlineStack>
            </BlockStack>
          </Box>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Remix Route Error Boundary UI
 * Use this in route files with export function ErrorBoundary
 */
export function RouteErrorBoundary({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary?: () => void;
}) {
  return (
    <Page>
      <Card>
        <Box padding="800">
          <BlockStack gap="400" inlineAlign="center">
            <Text as="h2" variant="headingLg">
              Error loading page
            </Text>
            <Text as="p" tone="subdued" alignment="center">
              {error?.message || "An unexpected error occurred"}
            </Text>
            <InlineStack gap="200">
              {resetErrorBoundary && (
                <Button onClick={resetErrorBoundary}>
                  Try again
                </Button>
              )}
              <Button variant="plain" url="/app">
                Go to Dashboard
              </Button>
            </InlineStack>
          </BlockStack>
        </Box>
      </Card>
    </Page>
  );
}

export default ErrorBoundary;
