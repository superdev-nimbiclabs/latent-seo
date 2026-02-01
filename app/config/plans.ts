/**
 * Plan definitions for LatentSEO billing
 */

export type PlanId = "FREE" | "PRO" | "ENTERPRISE";

export interface PlanFeature {
  name: string;
  included: boolean;
  limit?: number | "unlimited";
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  price: number; // Monthly price in USD
  trialDays: number;
  features: {
    productsPerMonth: number | "unlimited";
    metaDescriptions: boolean;
    metaTitles: boolean;
    altTextGeneration: boolean;
    schemaMarkup: boolean;
    customPrompts: boolean;
    prioritySupport: boolean;
    bulkOperations: boolean;
    exportHistory: boolean;
    seoAudit: boolean;
  };
  shopifyPlanName: string; // Name used in Shopify Billing API
}

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: "FREE",
    name: "Free",
    description: "Get started with basic SEO optimization",
    price: 0,
    trialDays: 0,
    features: {
      productsPerMonth: 25,
      metaDescriptions: true,
      metaTitles: true,
      altTextGeneration: false,
      schemaMarkup: false,
      customPrompts: false,
      prioritySupport: false,
      bulkOperations: true,
      exportHistory: false,
      seoAudit: true,
    },
    shopifyPlanName: "Free",
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    description: "Full SEO suite for growing stores",
    price: 19,
    trialDays: 7,
    features: {
      productsPerMonth: 500,
      metaDescriptions: true,
      metaTitles: true,
      altTextGeneration: true,
      schemaMarkup: true,
      customPrompts: false,
      prioritySupport: false,
      bulkOperations: true,
      exportHistory: true,
      seoAudit: true,
    },
    shopifyPlanName: "Pro",
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Unlimited optimization for large catalogs",
    price: 49,
    trialDays: 7,
    features: {
      productsPerMonth: "unlimited",
      metaDescriptions: true,
      metaTitles: true,
      altTextGeneration: true,
      schemaMarkup: true,
      customPrompts: true,
      prioritySupport: true,
      bulkOperations: true,
      exportHistory: true,
      seoAudit: true,
    },
    shopifyPlanName: "Enterprise",
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "PRO", "ENTERPRISE"];

/**
 * Get plan by ID
 */
export function getPlan(planId: PlanId): Plan {
  return PLANS[planId];
}

/**
 * Get default plan for new shops
 */
export function getDefaultPlan(): Plan {
  return PLANS.FREE;
}

/**
 * Check if a feature is available for a plan
 */
export function hasFeature(
  planId: PlanId,
  feature: keyof Plan["features"]
): boolean {
  const plan = PLANS[planId];
  const value = plan.features[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return value === "unlimited";
}

/**
 * Get the product limit for a plan
 */
export function getProductLimit(planId: PlanId): number | null {
  const limit = PLANS[planId].features.productsPerMonth;
  return limit === "unlimited" ? null : limit;
}

/**
 * Feature display names for UI
 */
export const FEATURE_DISPLAY_NAMES: Record<keyof Plan["features"], string> = {
  productsPerMonth: "Products per month",
  metaDescriptions: "Meta descriptions",
  metaTitles: "Meta titles",
  altTextGeneration: "AI alt text (Vision)",
  schemaMarkup: "Schema markup",
  customPrompts: "Custom AI prompts",
  prioritySupport: "Priority support",
  bulkOperations: "Bulk operations",
  exportHistory: "Export history",
  seoAudit: "SEO audit",
};
