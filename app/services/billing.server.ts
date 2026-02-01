import { prisma } from "../db.server.ts";
import { PLANS, type PlanId, getProductLimit } from "../config/plans.ts";

/**
 * Shopify Billing API integration for LatentSEO
 */

// GraphQL mutations for Shopify Billing
const CREATE_SUBSCRIPTION_MUTATION = `
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $trialDays: Int
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
      lineItems: $lineItems
    ) {
      appSubscription {
        id
        status
        trialDays
        currentPeriodEnd
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const CANCEL_SUBSCRIPTION_MUTATION = `
  mutation AppSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_ACTIVE_SUBSCRIPTIONS_QUERY = `
  query {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        trialDays
        currentPeriodEnd
        lineItems {
          id
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface AppSubscriptionCreateResponse {
  appSubscriptionCreate: {
    appSubscription: {
      id: string;
      status: string;
      trialDays: number;
      currentPeriodEnd: string;
    } | null;
    confirmationUrl: string | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

interface ActiveSubscriptionsResponse {
  currentAppInstallation: {
    activeSubscriptions: Array<{
      id: string;
      name: string;
      status: string;
      trialDays: number;
      currentPeriodEnd: string;
      lineItems: Array<{
        id: string;
        plan: {
          pricingDetails: {
            price: { amount: string; currencyCode: string };
            interval: string;
          };
        };
      }>;
    }>;
  };
}

/**
 * Execute a GraphQL query against Shopify Admin API
 */
async function shopifyBillingGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const result: ShopifyGraphQLResponse<T> = await response.json();

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join(", "));
  }

  return result.data as T;
}

/**
 * Create a subscription for a plan
 */
export async function createSubscription(
  shopDomain: string,
  accessToken: string,
  planId: PlanId,
  returnUrl: string,
  isTest: boolean = false
): Promise<{ confirmationUrl: string; subscriptionId: string }> {
  const plan = PLANS[planId];

  if (planId === "FREE") {
    // Free plan doesn't need a Shopify subscription
    await updateShopPlan(shopDomain, "FREE");
    return { confirmationUrl: returnUrl, subscriptionId: "free" };
  }

  const response = await shopifyBillingGraphQL<AppSubscriptionCreateResponse>(
    shopDomain,
    accessToken,
    CREATE_SUBSCRIPTION_MUTATION,
    {
      name: `LatentSEO ${plan.name}`,
      returnUrl,
      trialDays: plan.trialDays,
      test: isTest,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: plan.price,
                currencyCode: "USD",
              },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    }
  );

  if (response.appSubscriptionCreate.userErrors.length > 0) {
    const errors = response.appSubscriptionCreate.userErrors
      .map((e) => e.message)
      .join(", ");
    throw new Error(`Failed to create subscription: ${errors}`);
  }

  const subscription = response.appSubscriptionCreate.appSubscription;
  const confirmationUrl = response.appSubscriptionCreate.confirmationUrl;

  if (!subscription || !confirmationUrl) {
    throw new Error("Failed to create subscription");
  }

  // Store subscription in database (pending until confirmed via webhook)
  await prisma.subscription.upsert({
    where: { shopDomain },
    update: {
      shopifySubscriptionId: subscription.id,
      status: "PENDING",
      plan: planId,
      trialEndsAt: subscription.trialDays > 0
        ? new Date(Date.now() + subscription.trialDays * 24 * 60 * 60 * 1000)
        : null,
    },
    create: {
      shopDomain,
      shopifySubscriptionId: subscription.id,
      status: "PENDING",
      plan: planId,
      trialEndsAt: subscription.trialDays > 0
        ? new Date(Date.now() + subscription.trialDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  return { confirmationUrl, subscriptionId: subscription.id };
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  shopDomain: string,
  accessToken: string,
  reason?: string
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { shopDomain },
  });

  if (!subscription?.shopifySubscriptionId) {
    // No active subscription, just set to free
    await updateShopPlan(shopDomain, "FREE");
    return;
  }

  // Cancel in Shopify
  await shopifyBillingGraphQL(
    shopDomain,
    accessToken,
    CANCEL_SUBSCRIPTION_MUTATION,
    { id: subscription.shopifySubscriptionId }
  );

  // Update local records
  await prisma.subscription.update({
    where: { shopDomain },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  // Downgrade shop to free plan
  await updateShopPlan(shopDomain, "FREE");
}

/**
 * Sync subscription status from Shopify
 */
export async function syncSubscriptionStatus(
  shopDomain: string,
  accessToken: string
): Promise<{ plan: PlanId; status: string }> {
  const response = await shopifyBillingGraphQL<ActiveSubscriptionsResponse>(
    shopDomain,
    accessToken,
    GET_ACTIVE_SUBSCRIPTIONS_QUERY
  );

  const activeSubscriptions =
    response.currentAppInstallation.activeSubscriptions;

  if (activeSubscriptions.length === 0) {
    // No active subscription, ensure shop is on free plan
    await updateShopPlan(shopDomain, "FREE");
    await prisma.subscription.upsert({
      where: { shopDomain },
      update: { status: "EXPIRED", plan: "FREE" },
      create: { shopDomain, status: "ACTIVE", plan: "FREE" },
    });
    return { plan: "FREE", status: "ACTIVE" };
  }

  // Get the first active subscription (should only be one)
  const sub = activeSubscriptions[0];

  // Determine plan from subscription name
  let planId: PlanId = "FREE";
  if (sub.name.includes("Enterprise")) {
    planId = "ENTERPRISE";
  } else if (sub.name.includes("Pro")) {
    planId = "PRO";
  }

  // Update local records
  await prisma.subscription.upsert({
    where: { shopDomain },
    update: {
      shopifySubscriptionId: sub.id,
      status: sub.status,
      plan: planId,
      currentPeriodEnd: new Date(sub.currentPeriodEnd),
    },
    create: {
      shopDomain,
      shopifySubscriptionId: sub.id,
      status: sub.status,
      plan: planId,
      currentPeriodEnd: new Date(sub.currentPeriodEnd),
    },
  });

  await updateShopPlan(shopDomain, planId);

  return { plan: planId, status: sub.status };
}

/**
 * Update shop's plan
 */
async function updateShopPlan(shopDomain: string, planId: PlanId): Promise<void> {
  await prisma.shop.upsert({
    where: { shopDomain },
    update: { plan: planId },
    create: { shopDomain, plan: planId },
  });
}

/**
 * Get current billing period string (YYYY-MM)
 */
export function getCurrentBillingPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get or create usage record for current billing period
 */
export async function getOrCreateUsageRecord(shopDomain: string) {
  const billingPeriod = getCurrentBillingPeriod();

  return prisma.usageRecord.upsert({
    where: {
      shopDomain_billingPeriod: { shopDomain, billingPeriod },
    },
    update: {},
    create: {
      shopDomain,
      billingPeriod,
    },
  });
}

/**
 * Increment usage for a shop
 */
export async function incrementUsage(
  shopDomain: string,
  field: "productsOptimized" | "metaTitlesGenerated" | "metaDescriptionsGenerated" | "altTextsGenerated" | "schemasGenerated",
  count: number = 1
): Promise<void> {
  try {
    // Check if usageRecord model exists
    if (!prisma.usageRecord) {
      console.log("[Billing] UsageRecord model not available - skipping usage tracking");
      return;
    }

    const billingPeriod = getCurrentBillingPeriod();
    console.log(`[Billing] Incrementing ${field} by ${count} for ${shopDomain} (period: ${billingPeriod})`);

    const result = await prisma.usageRecord.upsert({
      where: {
        shopDomain_billingPeriod: { shopDomain, billingPeriod },
      },
      update: {
        [field]: { increment: count },
      },
      create: {
        shopDomain,
        billingPeriod,
        [field]: count,
      },
    });
    console.log(`[Billing] Usage updated:`, result);
  } catch (error) {
    console.error("[Billing] Error incrementing usage:", error);
    // Don't throw - usage tracking shouldn't block operations
  }
}

/**
 * Get current usage for a shop
 */
export async function getCurrentUsage(shopDomain: string): Promise<{
  productsOptimized: number;
  metaTitlesGenerated: number;
  metaDescriptionsGenerated: number;
  altTextsGenerated: number;
  schemasGenerated: number;
  limit: number | null;
  percentUsed: number;
}> {
  try {
    const billingPeriod = getCurrentBillingPeriod();

    // Check if usageRecord model exists (handles case where prisma hasn't been regenerated)
    if (!prisma.usageRecord) {
      console.log("[Billing] UsageRecord model not available - prisma needs regeneration");
      const shop = await prisma.shop.findUnique({
        where: { shopDomain },
        select: { plan: true },
      });
      const planId = (shop?.plan as PlanId) || "FREE";
      const limit = getProductLimit(planId);
      return {
        productsOptimized: 0,
        metaTitlesGenerated: 0,
        metaDescriptionsGenerated: 0,
        altTextsGenerated: 0,
        schemasGenerated: 0,
        limit,
        percentUsed: 0,
      };
    }

    const [usage, shop] = await Promise.all([
      prisma.usageRecord.findUnique({
        where: {
          shopDomain_billingPeriod: { shopDomain, billingPeriod },
        },
      }),
      prisma.shop.findUnique({
        where: { shopDomain },
        select: { plan: true },
      }),
    ]);

    const planId = (shop?.plan as PlanId) || "FREE";
    const limit = getProductLimit(planId);

    const productsOptimized = usage?.productsOptimized || 0;
    const percentUsed = limit ? Math.min(100, (productsOptimized / limit) * 100) : 0;

    return {
      productsOptimized,
      metaTitlesGenerated: usage?.metaTitlesGenerated || 0,
      metaDescriptionsGenerated: usage?.metaDescriptionsGenerated || 0,
      altTextsGenerated: usage?.altTextsGenerated || 0,
      schemasGenerated: usage?.schemasGenerated || 0,
      limit,
      percentUsed,
    };
  } catch (error) {
    console.error("[Billing] Error getting usage:", error);
    // Return defaults on error
    return {
      productsOptimized: 0,
      metaTitlesGenerated: 0,
      metaDescriptionsGenerated: 0,
      altTextsGenerated: 0,
      schemasGenerated: 0,
      limit: 25, // FREE plan default
      percentUsed: 0,
    };
  }
}

/**
 * Check if shop can optimize more products
 */
export async function canOptimize(shopDomain: string): Promise<{
  allowed: boolean;
  reason?: string;
  usage: number;
  limit: number | null;
}> {
  try {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
      select: { plan: true },
    });

    const planId = (shop?.plan as PlanId) || "FREE";
    const limit = getProductLimit(planId);

    // Unlimited plan
    if (limit === null) {
      return { allowed: true, usage: 0, limit: null };
    }

    const { productsOptimized } = await getCurrentUsage(shopDomain);

    if (productsOptimized >= limit) {
      return {
        allowed: false,
        reason: `You've reached your monthly limit of ${limit} products. Upgrade to continue optimizing.`,
        usage: productsOptimized,
        limit,
      };
    }

    return { allowed: true, usage: productsOptimized, limit };
  } catch (error) {
    console.error("[Billing] Error checking optimization limit:", error);
    // Allow optimization on error (fail open for better UX)
    return { allowed: true, usage: 0, limit: null };
  }
}

/**
 * Get subscription details for a shop
 */
export async function getSubscriptionDetails(shopDomain: string) {
  const [shop, subscription, usage] = await Promise.all([
    prisma.shop.findUnique({
      where: { shopDomain },
      select: { plan: true },
    }),
    prisma.subscription.findUnique({
      where: { shopDomain },
    }),
    getCurrentUsage(shopDomain),
  ]);

  const planId = (shop?.plan as PlanId) || "FREE";
  const plan = PLANS[planId];

  return {
    plan,
    planId,
    subscription,
    usage,
    isActive: subscription?.status === "ACTIVE" || planId === "FREE",
    isTrial: subscription?.trialEndsAt
      ? new Date(subscription.trialEndsAt) > new Date()
      : false,
    trialEndsAt: subscription?.trialEndsAt,
    currentPeriodEnd: subscription?.currentPeriodEnd,
  };
}

/**
 * Handle subscription webhook from Shopify
 */
export async function handleSubscriptionWebhook(
  shopDomain: string,
  webhookData: {
    app_subscription?: {
      admin_graphql_api_id: string;
      status: string;
      name: string;
    };
  }
): Promise<void> {
  const appSubscription = webhookData.app_subscription;

  if (!appSubscription) {
    console.log("[Billing] No subscription data in webhook");
    return;
  }

  // Determine plan from name
  let planId: PlanId = "FREE";
  if (appSubscription.name.includes("Enterprise")) {
    planId = "ENTERPRISE";
  } else if (appSubscription.name.includes("Pro")) {
    planId = "PRO";
  }

  // Map Shopify status to our status
  const status = appSubscription.status.toUpperCase();

  await prisma.subscription.upsert({
    where: { shopDomain },
    update: {
      shopifySubscriptionId: appSubscription.admin_graphql_api_id,
      status,
      plan: planId,
    },
    create: {
      shopDomain,
      shopifySubscriptionId: appSubscription.admin_graphql_api_id,
      status,
      plan: planId,
    },
  });

  // Update shop plan if subscription is active
  if (status === "ACTIVE") {
    await updateShopPlan(shopDomain, planId);
  } else if (status === "CANCELLED" || status === "EXPIRED") {
    await updateShopPlan(shopDomain, "FREE");
  }

  console.log(`[Billing] Updated subscription for ${shopDomain}: ${planId} (${status})`);
}
