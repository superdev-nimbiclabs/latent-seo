import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  Badge,
  Divider,
  ProgressBar,
  Banner,
  Icon,
  InlineGrid,
} from "@shopify/polaris";
import { CheckIcon, XIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getSubscriptionDetails,
  createSubscription,
  cancelSubscription,
  getCurrentBillingPeriod,
} from "../services/billing.server";
import { PLANS, PLAN_ORDER, FEATURE_DISPLAY_NAMES, type PlanId, type Plan } from "../config/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const subscriptionDetails = await getSubscriptionDetails(session.shop);
  const billingPeriod = getCurrentBillingPeriod();

  return json({
    shopDomain: session.shop,
    ...subscriptionDetails,
    billingPeriod,
    plans: PLAN_ORDER.map((id) => PLANS[id]),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "subscribe") {
    const planId = formData.get("planId") as PlanId;

    if (!planId || !PLANS[planId]) {
      return json({ error: "Invalid plan" }, { status: 400 });
    }

    try {
      // Use app URL for return
      const url = new URL(request.url);
      const returnUrl = `${url.origin}/app/billing?subscribed=true`;

      const { confirmationUrl } = await createSubscription(
        session.shop,
        session.accessToken!,
        planId,
        returnUrl,
        process.env.NODE_ENV === "development" // Use test mode in dev
      );

      // Redirect to Shopify's confirmation page
      return redirect(confirmationUrl);
    } catch (error) {
      console.error("[Billing] Subscription error:", error);
      return json({
        error: error instanceof Error ? error.message : "Failed to create subscription",
      }, { status: 500 });
    }
  }

  if (intent === "cancel") {
    try {
      await cancelSubscription(session.shop, session.accessToken!);
      return json({ success: true, cancelled: true });
    } catch (error) {
      console.error("[Billing] Cancellation error:", error);
      return json({
        error: error instanceof Error ? error.message : "Failed to cancel subscription",
      }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

function FeatureRow({ name, included, value }: { name: string; included: boolean; value?: string | number }) {
  return (
    <InlineStack gap="200" align="start" blockAlign="center">
      <Box>
        {included ? (
          <Icon source={CheckIcon} tone="success" />
        ) : (
          <Icon source={XIcon} tone="subdued" />
        )}
      </Box>
      <Text as="span" tone={included ? undefined : "subdued"}>
        {value ? `${value} ${name}` : name}
      </Text>
    </InlineStack>
  );
}

function PlanCard({
  plan,
  isCurrentPlan,
  onSelect,
  isLoading,
}: {
  plan: Plan;
  isCurrentPlan: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const isPopular = plan.id === "PRO";

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <InlineStack align="space-between">
            <Text as="h3" variant="headingMd">
              {plan.name}
            </Text>
            {isPopular && <Badge tone="info">Popular</Badge>}
            {isCurrentPlan && <Badge tone="success">Current</Badge>}
          </InlineStack>
          <Text as="p" tone="subdued">
            {plan.description}
          </Text>
        </BlockStack>

        <BlockStack gap="100">
          <InlineStack gap="100" blockAlign="end">
            <Text as="span" variant="headingXl">
              ${plan.price}
            </Text>
            {plan.price > 0 && (
              <Text as="span" tone="subdued">
                /month
              </Text>
            )}
          </InlineStack>
          {plan.trialDays > 0 && (
            <Text as="p" variant="bodySm" tone="subdued">
              {plan.trialDays}-day free trial
            </Text>
          )}
        </BlockStack>

        <Divider />

        <BlockStack gap="200">
          <FeatureRow
            name="products/month"
            included={true}
            value={plan.features.productsPerMonth === "unlimited" ? "Unlimited" : plan.features.productsPerMonth}
          />
          <FeatureRow name="Meta titles & descriptions" included={plan.features.metaTitles} />
          <FeatureRow name="AI alt text (Vision)" included={plan.features.altTextGeneration} />
          <FeatureRow name="Schema markup" included={plan.features.schemaMarkup} />
          <FeatureRow name="Custom AI prompts" included={plan.features.customPrompts} />
          <FeatureRow name="Export history" included={plan.features.exportHistory} />
          <FeatureRow name="Priority support" included={plan.features.prioritySupport} />
        </BlockStack>

        <Box paddingBlockStart="200">
          {isCurrentPlan ? (
            <Button disabled fullWidth>
              Current Plan
            </Button>
          ) : (
            <Button
              variant={isPopular ? "primary" : undefined}
              onClick={onSelect}
              loading={isLoading}
              fullWidth
            >
              {plan.price === 0 ? "Downgrade" : "Upgrade"}
            </Button>
          )}
        </Box>
      </BlockStack>
    </Card>
  );
}

export default function BillingPage() {
  const {
    planId,
    plan,
    usage,
    isActive,
    isTrial,
    trialEndsAt,
    currentPeriodEnd,
    billingPeriod,
    plans,
  } = useLoaderData<typeof loader>();

  const fetcher = useFetcher<typeof action>();
  const isLoading = fetcher.state !== "idle";

  // Check for success/error messages
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const justSubscribed = searchParams.get("subscribed") === "true";

  const handleSelectPlan = (selectedPlanId: PlanId) => {
    fetcher.submit(
      { intent: "subscribe", planId: selectedPlanId },
      { method: "POST" }
    );
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel your subscription? You'll be downgraded to the Free plan.")) {
      fetcher.submit({ intent: "cancel" }, { method: "POST" });
    }
  };

  // Format dates
  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Page>
      <TitleBar title="Billing & Plans" />
      <BlockStack gap="500">
        {/* Success banner */}
        {justSubscribed && (
          <Banner title="Subscription activated!" tone="success" onDismiss={() => {}}>
            <Text as="p">Your subscription is now active. Enjoy all the features!</Text>
          </Banner>
        )}

        {/* Trial banner */}
        {isTrial && trialEndsAt && (
          <Banner title="You're on a free trial" tone="info">
            <Text as="p">
              Your trial ends on {formatDate(trialEndsAt)}. Add a payment method to continue using {plan.name} features.
            </Text>
          </Banner>
        )}

        {/* Error banner */}
        {fetcher.data && "error" in fetcher.data && (
          <Banner title="Error" tone="critical">
            <Text as="p">{fetcher.data.error}</Text>
          </Banner>
        )}

        {/* Current Usage */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Current Usage
            </Text>

            <InlineGrid columns={["oneThird", "twoThirds"]} gap="400">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Billing Period
                </Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {billingPeriod}
                </Text>
              </BlockStack>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Products Optimized
                  </Text>
                  <Text as="p" variant="bodySm">
                    {usage.productsOptimized} / {usage.limit || "Unlimited"}
                  </Text>
                </InlineStack>
                {usage.limit && (
                  <ProgressBar
                    progress={usage.percentUsed}
                    size="small"
                    tone={usage.percentUsed > 80 ? "critical" : undefined}
                  />
                )}
              </BlockStack>
            </InlineGrid>

            <Divider />

            <InlineGrid columns={4} gap="400">
              <BlockStack gap="100">
                <Text as="p" variant="headingLg">
                  {usage.metaTitlesGenerated}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Titles
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="headingLg">
                  {usage.metaDescriptionsGenerated}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Descriptions
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="headingLg">
                  {usage.altTextsGenerated}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Alt Texts
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="headingLg">
                  {usage.schemasGenerated}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Schemas
                </Text>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* Current Plan Summary */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Current Plan: {plan.name}
                </Text>
                <Text as="p" tone="subdued">
                  {plan.description}
                </Text>
              </BlockStack>
              {planId !== "FREE" && (
                <Button variant="plain" tone="critical" onClick={handleCancel}>
                  Cancel subscription
                </Button>
              )}
            </InlineStack>

            {currentPeriodEnd && planId !== "FREE" && (
              <Text as="p" variant="bodySm" tone="subdued">
                Next billing date: {formatDate(currentPeriodEnd)}
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Plan Selection */}
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Choose a Plan
          </Text>

          <InlineGrid columns={3} gap="400">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                isCurrentPlan={p.id === planId}
                onSelect={() => handleSelectPlan(p.id)}
                isLoading={isLoading}
              />
            ))}
          </InlineGrid>
        </BlockStack>
      </BlockStack>
    </Page>
  );
}
