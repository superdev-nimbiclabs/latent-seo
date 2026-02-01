import { Banner, Button, Text, InlineStack, ProgressBar, BlockStack } from "@shopify/polaris";
import { Link } from "@remix-run/react";

interface UpgradePromptProps {
  usage: number;
  limit: number;
  variant?: "banner" | "inline";
  onDismiss?: () => void;
}

export function UpgradePrompt({
  usage,
  limit,
  variant = "banner",
  onDismiss,
}: UpgradePromptProps) {
  const percentUsed = Math.min(100, (usage / limit) * 100);
  const isAtLimit = usage >= limit;
  const isNearLimit = percentUsed >= 80;

  if (!isNearLimit && !isAtLimit) {
    return null;
  }

  if (variant === "inline") {
    return (
      <BlockStack gap="200">
        <InlineStack align="space-between">
          <Text as="span" variant="bodySm" tone="subdued">
            {usage} / {limit} products used
          </Text>
          {isAtLimit && (
            <Link to="/app/billing">
              <Button size="slim" variant="primary">
                Upgrade
              </Button>
            </Link>
          )}
        </InlineStack>
        <ProgressBar
          progress={percentUsed}
          size="small"
          tone={isAtLimit ? "critical" : "warning"}
        />
      </BlockStack>
    );
  }

  if (isAtLimit) {
    return (
      <Banner
        title="Monthly limit reached"
        tone="critical"
        onDismiss={onDismiss}
        action={{
          content: "Upgrade Now",
          url: "/app/billing",
        }}
      >
        <Text as="p">
          You've optimized {usage} of {limit} products this month.
          Upgrade to Pro or Enterprise for more optimizations.
        </Text>
      </Banner>
    );
  }

  // Near limit warning
  return (
    <Banner
      title="Approaching monthly limit"
      tone="warning"
      onDismiss={onDismiss}
      action={{
        content: "View Plans",
        url: "/app/billing",
      }}
    >
      <Text as="p">
        You've used {usage} of {limit} products ({Math.round(percentUsed)}%).
        Consider upgrading for more optimizations.
      </Text>
    </Banner>
  );
}

interface FeatureGateProps {
  feature: string;
  planRequired: "PRO" | "ENTERPRISE";
  children?: React.ReactNode;
}

export function FeatureGate({ feature, planRequired, children }: FeatureGateProps) {
  return (
    <Banner
      title={`${feature} requires ${planRequired} plan`}
      tone="info"
      action={{
        content: `Upgrade to ${planRequired}`,
        url: "/app/billing",
      }}
    >
      {children || (
        <Text as="p">
          This feature is available on the {planRequired} plan and above.
        </Text>
      )}
    </Banner>
  );
}
