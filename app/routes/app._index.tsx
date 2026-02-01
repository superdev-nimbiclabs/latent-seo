import { useEffect, useState, useCallback } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Box,
  DataTable,
  Badge,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getShopStats } from "../services/shop.server";
import { getProductCounts } from "../services/products.server";
import { addSeoFixJob, getQueueStats } from "../lib/queue.server";
import { prisma } from "../db.server";
import { DashboardStats } from "../components/seo/DashboardStats";
import { JobProgressBanner } from "../components/seo/JobProgressBanner";
import { UpgradePrompt } from "../components/billing/UpgradePrompt";
import { OnboardingWizard, getDefaultOnboardingSteps } from "../components/onboarding/OnboardingWizard";
import { TrendChart } from "../components/analytics/TrendChart";
import { useJobPolling } from "../hooks/useJobPolling";
import { getCurrentUsage } from "../services/billing.server";
import { getDashboardAnalytics } from "../services/analytics.server";
import { getProductLimit } from "../config/plans";
import type { ProductCounts, ActiveJob } from "../types/seo";
import type { PlanId } from "../config/plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Fetch all data in parallel
  const [shopStats, queueStats, productCounts, activeJob, shop, usage, analytics] = await Promise.all([
    getShopStats(shopDomain),
    getQueueStats(),
    getProductCounts(admin),
    // Get the most recent active job for this shop
    prisma.job.findFirst({
      where: {
        shopDomain,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Get shop plan
    prisma.shop.findUnique({
      where: { shopDomain },
      select: { plan: true },
    }),
    // Get current usage
    getCurrentUsage(shopDomain),
    // Get analytics data
    getDashboardAnalytics(shopDomain),
  ]);

  const planId = (shop?.plan as PlanId) || "FREE";
  const limit = getProductLimit(planId);

  // Onboarding state
  const isFirstTimeUser = shopStats.totalOptimized === 0 && shopStats.totalJobs === 0;
  const onboarding = {
    hasProducts: productCounts.total > 0,
    hasOptimized: shopStats.totalOptimized > 0,
    hasSchemaEnabled: false, // Would need theme API check
    settingsConfigured: shop?.plan !== "FREE" || shopStats.totalJobs > 0,
  };

  return json({
    shopDomain,
    shopStats,
    queueStats,
    productCounts,
    activeJob: activeJob
      ? {
          id: activeJob.id,
          type: activeJob.type,
          processed: activeJob.processedItems,
          total: activeJob.totalItems,
          status: activeJob.status,
        }
      : null,
    usage: {
      current: usage.productsOptimized,
      limit,
    },
    planId,
    isFirstTimeUser,
    onboarding,
    analytics,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const jobType = formData.get("jobType") as
    | "META_DESCRIPTION"
    | "SCHEMA_INJECTION";

  if (!jobType) {
    return json({ success: false, error: "Missing jobType" }, { status: 400 });
  }

  try {
    const jobId = await addSeoFixJob({
      shopDomain: session.shop,
      jobType,
    });

    return json({ success: true, jobId });
  } catch (error) {
    console.error("[Dashboard] Failed to start job:", error);
    return json(
      { success: false, error: "Failed to start optimization job" },
      { status: 500 }
    );
  }
};

export default function DashboardIndex() {
  const {
    shopStats,
    productCounts,
    activeJob: initialActiveJob,
    usage,
    planId,
    isFirstTimeUser,
    onboarding,
    analytics,
  } = useLoaderData<typeof loader>();

  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();

  const [currentJobId, setCurrentJobId] = useState<string | null>(
    initialActiveJob?.id || null
  );
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);
  const [completedJob, setCompletedJob] = useState<ActiveJob | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(isFirstTimeUser);

  // Handle job completion
  const handleJobComplete = useCallback((job: ActiveJob) => {
    setCompletedJob(job);
    setShowCompleteBanner(true);
    setCurrentJobId(null);
    // Refresh the page data
    revalidator.revalidate();
  }, [revalidator]);

  // Poll for job status
  const { job: polledJob, isPolling } = useJobPolling({
    jobId: currentJobId,
    interval: 2000,
    onComplete: handleJobComplete,
  });

  // Start a new job when action completes
  useEffect(() => {
    const data = fetcher.data;
    if (data && 'success' in data && data.success && 'jobId' in data) {
      setCurrentJobId(data.jobId);
      setShowCompleteBanner(false);
      setCompletedJob(null);
    }
  }, [fetcher.data]);

  const isLoading = fetcher.state !== "idle";
  const activeJob = polledJob || initialActiveJob;

  const startJob = (jobType: string) => {
    fetcher.submit({ jobType }, { method: "POST" });
  };

  // Format recent activity for table
  const recentActivityRows = shopStats.recentLogs.slice(0, 5).map((log) => [
    new Date(log.createdAt).toLocaleDateString(),
    log.productId.replace("gid://shopify/Product/", "#"),
    log.field,
    log.isReverted ? (
      <Badge tone="warning">Reverted</Badge>
    ) : (
      <Badge tone="success">Applied</Badge>
    ),
  ]);

  // Toast notification for job completion
  useEffect(() => {
    if (showCompleteBanner && completedJob) {
      shopify.toast.show(`Optimization complete: ${completedJob.processed} items processed`);
    }
  }, [showCompleteBanner, completedJob, shopify]);

  // Get onboarding steps
  const onboardingSteps = getDefaultOnboardingSteps(onboarding);

  return (
    <Page>
      <TitleBar title="LatentSEO Dashboard" />
      <BlockStack gap="500">
        {/* Onboarding Wizard for first-time users */}
        {showOnboarding && (
          <OnboardingWizard
            steps={onboardingSteps}
            onDismiss={() => setShowOnboarding(false)}
            onComplete={() => {
              setShowOnboarding(false);
              shopify.toast.show("Setup complete!");
            }}
          />
        )}

        {/* Job Progress Banner */}
        {showCompleteBanner && completedJob && (
          <JobProgressBanner
            job={completedJob}
            onDismiss={() => setShowCompleteBanner(false)}
          />
        )}

        {activeJob && !showCompleteBanner && (
          <JobProgressBanner job={activeJob as ActiveJob} />
        )}

        {/* Usage/Upgrade Prompt */}
        {usage.limit && (
          <UpgradePrompt usage={usage.current} limit={usage.limit} />
        )}

        {/* Stats Cards */}
        <DashboardStats counts={productCounts as ProductCounts} />

        {/* Quick Actions */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick Actions
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Generate AI-powered SEO content for all products missing them.
                </Text>
                <InlineStack gap="200">
                  <Button
                    variant="primary"
                    onClick={() => startJob("META_DESCRIPTION")}
                    loading={isLoading && !activeJob}
                    disabled={!!activeJob || isPolling}
                  >
                    Optimize All SEO
                  </Button>
                  <Button
                    onClick={() => startJob("ALT_TEXT")}
                    loading={isLoading && !activeJob}
                    disabled={!!activeJob || isPolling}
                  >
                    Optimize Alt Text
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Recent Activity */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Recent Activity
                  </Text>
                  <Button variant="plain" url="/app/history">
                    View all
                  </Button>
                </InlineStack>

                {recentActivityRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Date", "Product", "Field", "Status"]}
                    rows={recentActivityRows}
                  />
                ) : (
                  <Box paddingBlock="400">
                    <EmptyState
                      heading="No recent activity"
                      image=""
                    >
                      <Text as="p" tone="subdued">
                        Start optimizing products to see activity here.
                      </Text>
                    </EmptyState>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Summary Stats */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Total Optimizations
                </Text>
                <Text as="p" variant="headingLg">
                  {shopStats.totalOptimized.toLocaleString()}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Jobs Run
                </Text>
                <Text as="p" variant="headingLg">
                  {shopStats.totalJobs.toLocaleString()}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Queue Status
                </Text>
                <Text as="p" variant="bodyMd">
                  {activeJob ? "Processing..." : "Idle"}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* 7-Day Trend Chart */}
        {analytics.dailyTrends.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Optimization Trend (7 Days)
                </Text>
                <Button variant="plain" url="/app/reports">
                  View Reports
                </Button>
              </InlineStack>
              <TrendChart
                data={analytics.dailyTrends.map((d) => ({
                  date: d.date,
                  value: d.optimizations,
                }))}
                color="primary"
                height={100}
              />
            </BlockStack>
          </Card>
        )}

        {/* This Month Stats */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  This Month
                </Text>
                <Text as="p" variant="headingLg">
                  {analytics.thisMonthOptimizations}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  optimizations
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  SEO Health
                </Text>
                <Text as="p" variant="headingLg">
                  {analytics.seoHealthScore}%
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  score
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Products Optimized
                </Text>
                <Text as="p" variant="headingLg">
                  {analytics.totalProductsOptimized}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  total
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
