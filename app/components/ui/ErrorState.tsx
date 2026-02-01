import {
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Box,
  Banner,
  Icon,
} from "@shopify/polaris";
import { AlertCircleIcon, RefreshIcon } from "@shopify/polaris-icons";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  helpUrl?: string;
  helpLabel?: string;
}

/**
 * Full-page error state with retry option
 */
export function ErrorState({
  title = "Something went wrong",
  message = "We encountered an error while loading this page. Please try again.",
  onRetry,
  retryLabel = "Try again",
  helpUrl,
  helpLabel = "Get help",
}: ErrorStateProps) {
  return (
    <Card>
      <Box padding="800">
        <BlockStack gap="400" inlineAlign="center">
          <Box>
            <Icon source={AlertCircleIcon} tone="critical" />
          </Box>
          <BlockStack gap="200" inlineAlign="center">
            <Text as="h2" variant="headingMd">
              {title}
            </Text>
            <Text as="p" tone="subdued" alignment="center">
              {message}
            </Text>
          </BlockStack>
          <InlineStack gap="200">
            {onRetry && (
              <Button onClick={onRetry} icon={RefreshIcon}>
                {retryLabel}
              </Button>
            )}
            {helpUrl && (
              <Button variant="plain" url={helpUrl} target="_blank">
                {helpLabel}
              </Button>
            )}
          </InlineStack>
        </BlockStack>
      </Box>
    </Card>
  );
}

/**
 * Inline error banner with retry
 */
export function ErrorBanner({
  title = "Error",
  message,
  onRetry,
  onDismiss,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <Banner
      title={title}
      tone="critical"
      onDismiss={onDismiss}
      action={
        onRetry
          ? {
              content: "Try again",
              onAction: onRetry,
            }
          : undefined
      }
    >
      <Text as="p">{message}</Text>
    </Banner>
  );
}

/**
 * Connection error state (common for API issues)
 */
export function ConnectionError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Connection error"
      message="We couldn't connect to Shopify. Please check your internet connection and try again."
      onRetry={onRetry}
    />
  );
}

/**
 * Not found error state
 */
export function NotFoundError({
  itemName = "item",
  backUrl,
}: {
  itemName?: string;
  backUrl?: string;
}) {
  return (
    <Card>
      <Box padding="800">
        <BlockStack gap="400" inlineAlign="center">
          <Text as="h2" variant="headingMd">
            {itemName.charAt(0).toUpperCase() + itemName.slice(1)} not found
          </Text>
          <Text as="p" tone="subdued" alignment="center">
            The {itemName} you're looking for doesn't exist or has been removed.
          </Text>
          {backUrl && (
            <Button url={backUrl}>Go back</Button>
          )}
        </BlockStack>
      </Box>
    </Card>
  );
}

/**
 * Permission error state
 */
export function PermissionError() {
  return (
    <ErrorState
      title="Access denied"
      message="You don't have permission to access this feature. Please contact your store administrator."
    />
  );
}

/**
 * Rate limit error state
 */
export function RateLimitError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Too many requests"
      message="We're receiving too many requests. Please wait a moment and try again."
      onRetry={onRetry}
      retryLabel="Retry"
    />
  );
}

/**
 * Plan limit reached error state
 */
export function PlanLimitError({
  currentPlan,
  upgradeUrl = "/app/billing",
}: {
  currentPlan?: string;
  upgradeUrl?: string;
}) {
  return (
    <Banner
      title="Plan limit reached"
      tone="warning"
      action={{
        content: "Upgrade plan",
        url: upgradeUrl,
      }}
    >
      <Text as="p">
        You've reached the optimization limit for your {currentPlan || "current"} plan.
        Upgrade to continue optimizing products.
      </Text>
    </Banner>
  );
}

/**
 * Empty queue state
 */
export function EmptyQueueState({
  title = "No pending jobs",
  message = "All optimization jobs have been completed.",
  actionLabel,
  actionUrl,
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  actionUrl?: string;
}) {
  return (
    <Card>
      <Box padding="600">
        <BlockStack gap="300" inlineAlign="center">
          <Text as="h3" variant="headingMd">
            {title}
          </Text>
          <Text as="p" tone="subdued" alignment="center">
            {message}
          </Text>
          {actionLabel && actionUrl && (
            <Button url={actionUrl}>{actionLabel}</Button>
          )}
        </BlockStack>
      </Box>
    </Card>
  );
}
