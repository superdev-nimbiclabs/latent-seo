import { useState, useCallback } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  ProgressBar,
  Icon,
  Divider,
  Banner,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
  StatusIcon,
  ChevronRightIcon,
} from "@shopify/polaris-icons";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  action?: {
    label: string;
    url?: string;
    onClick?: () => void;
  };
}

interface OnboardingWizardProps {
  steps: OnboardingStep[];
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function OnboardingWizard({
  steps,
  onComplete,
  onDismiss,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(
    steps.findIndex((s) => !s.isComplete)
  );

  const completedCount = steps.filter((s) => s.isComplete).length;
  const progress = (completedCount / steps.length) * 100;
  const isAllComplete = completedCount === steps.length;

  const handleNextStep = useCallback(() => {
    const nextIncomplete = steps.findIndex(
      (s, i) => i > currentStep && !s.isComplete
    );
    if (nextIncomplete !== -1) {
      setCurrentStep(nextIncomplete);
    } else if (isAllComplete && onComplete) {
      onComplete();
    }
  }, [steps, currentStep, isAllComplete, onComplete]);

  if (isAllComplete) {
    return (
      <Banner
        title="Setup complete!"
        tone="success"
        onDismiss={onDismiss}
      >
        <Text as="p">
          You're all set! LatentSEO is ready to optimize your store's SEO.
        </Text>
      </Banner>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Get started with LatentSEO
            </Text>
            <Text as="p" tone="subdued">
              Complete these steps to set up your store
            </Text>
          </BlockStack>
          {onDismiss && (
            <Button variant="plain" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </InlineStack>

        <Box>
          <InlineStack gap="200" align="center">
            <Box minWidth="100%">
              <ProgressBar progress={progress} size="small" tone="primary" />
            </Box>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {completedCount} of {steps.length} complete
          </Text>
        </Box>

        <Divider />

        <BlockStack gap="300">
          {steps.map((step, index) => (
            <Box
              key={step.id}
              padding="300"
              background={
                index === currentStep ? "bg-surface-secondary" : undefined
              }
              borderRadius="200"
            >
              <InlineStack gap="300" align="start" blockAlign="start">
                <Box>
                  <Icon
                    source={step.isComplete ? CheckCircleIcon : StatusIcon}
                    tone={step.isComplete ? "success" : "subdued"}
                  />
                </Box>
                <BlockStack gap="100">
                  <Text
                    as="p"
                    variant="bodyMd"
                    fontWeight={index === currentStep ? "semibold" : "regular"}
                  >
                    {step.title}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {step.description}
                  </Text>
                  {index === currentStep && step.action && !step.isComplete && (
                    <Box paddingBlockStart="200">
                      <Button
                        size="slim"
                        url={step.action.url}
                        onClick={step.action.onClick}
                      >
                        {step.action.label}
                        <Icon source={ChevronRightIcon} />
                      </Button>
                    </Box>
                  )}
                </BlockStack>
              </InlineStack>
            </Box>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

// Pre-configured steps for LatentSEO
export function getDefaultOnboardingSteps(config: {
  hasProducts: boolean;
  hasOptimized: boolean;
  hasSchemaEnabled: boolean;
  settingsConfigured: boolean;
}): OnboardingStep[] {
  return [
    {
      id: "products",
      title: "Add products to your store",
      description: "You need at least one product to optimize",
      isComplete: config.hasProducts,
      action: {
        label: "Add products",
        url: "shopify://admin/products/new",
      },
    },
    {
      id: "settings",
      title: "Configure AI settings",
      description: "Choose your preferred AI tone and auto-publish preferences",
      isComplete: config.settingsConfigured,
      action: {
        label: "Go to Settings",
        url: "/app/settings",
      },
    },
    {
      id: "optimize",
      title: "Run your first optimization",
      description: "Generate SEO content for your products",
      isComplete: config.hasOptimized,
      action: {
        label: "Optimize products",
        url: "/app/products",
      },
    },
    {
      id: "schema",
      title: "Enable Schema markup",
      description: "Add structured data for Google rich results",
      isComplete: config.hasSchemaEnabled,
      action: {
        label: "Set up Schema",
        url: "/app/settings",
      },
    },
  ];
}
