import { useCallback, useState } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Box,
  Select,
  Banner,
  Divider,
  List,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getDashboardAnalytics, getMonthlyTrends, getOptimizationBreakdown } from "../services/analytics.server";
import { auditProducts } from "../services/seo-audit.server";
import { prisma } from "../db.server";

// GraphQL query to fetch products with SEO data for audit
const PRODUCTS_QUERY = `#graphql
  query GetProductsForReport($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          seo {
            title
            description
          }
          images(first: 10) {
            edges {
              node {
                id
                altText
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [analytics, monthlyTrends, breakdown] = await Promise.all([
    getDashboardAnalytics(session.shop),
    getMonthlyTrends(session.shop),
    getOptimizationBreakdown(session.shop),
  ]);

  return json({
    shopDomain: session.shop,
    analytics,
    monthlyTrends,
    breakdown,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const reportType = formData.get("reportType") as string;

  if (reportType === "seo-audit") {
    // Fetch all products for audit
    const allProducts: any[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage && allProducts.length < 500) {
      const response = await admin.graphql(PRODUCTS_QUERY, {
        variables: { cursor },
      });

      const data = await response.json();
      const products = data.data.products.edges.map((e: any) => e.node);
      allProducts.push(...products);

      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
    }

    // Transform for audit
    const productsForAudit = allProducts.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      descriptionHtml: p.descriptionHtml,
      seo: p.seo,
      images: p.images.edges.map((e: any) => e.node),
    }));

    const { results, stats } = auditProducts(productsForAudit);

    // Build CSV
    const headers = [
      "Product ID",
      "Product Title",
      "Handle",
      "SEO Score",
      "Has Meta Title",
      "Meta Title Length",
      "Has Meta Description",
      "Meta Description Length",
      "Images Without Alt Text",
      "Total Images",
      "Issues",
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (!value) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = results.map((result) => {
      const product = productsForAudit.find((p) => p.id === result.productId);
      const imagesWithoutAlt = product?.images.filter((img: any) => !img.altText || img.altText.trim() === "").length || 0;
      const totalImages = product?.images.length || 0;

      return [
        result.productId.replace("gid://shopify/Product/", ""),
        escapeCSV(result.productTitle),
        escapeCSV(product?.handle),
        result.score,
        product?.seo?.title ? "Yes" : "No",
        product?.seo?.title?.length || 0,
        product?.seo?.description ? "Yes" : "No",
        product?.seo?.description?.length || 0,
        imagesWithoutAlt,
        totalImages,
        escapeCSV(result.issues.map((i) => `[${i.severity}] ${i.message}`).join("; ")),
      ];
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return json({
      success: true,
      reportType: "seo-audit",
      csv,
      stats: {
        totalProducts: stats.totalProducts,
        avgScore: stats.avgScore,
        criticalCount: stats.criticalCount,
        optimizedCount: stats.optimizedCount,
      },
    });
  }

  if (reportType === "optimization-history") {
    // Fetch all optimization logs
    const logs = await prisma.optimizationLog.findMany({
      where: { shopDomain: session.shop },
      orderBy: { createdAt: "desc" },
      include: {
        job: {
          select: { type: true },
        },
      },
    });

    const headers = [
      "Date",
      "Product ID",
      "Product Title",
      "Job Type",
      "Field",
      "Old Value",
      "New Value",
      "Status",
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (!value) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      log.productId.replace("gid://shopify/Product/", ""),
      escapeCSV(log.productTitle),
      log.job?.type || "Unknown",
      log.field,
      escapeCSV(log.oldValue),
      escapeCSV(log.newValue),
      log.isReverted ? "Reverted" : "Active",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return json({
      success: true,
      reportType: "optimization-history",
      csv,
      stats: {
        totalRecords: logs.length,
        activeCount: logs.filter((l) => !l.isReverted).length,
        revertedCount: logs.filter((l) => l.isReverted).length,
      },
    });
  }

  if (reportType === "monthly-summary") {
    const analytics = await getDashboardAnalytics(session.shop);
    const monthlyTrends = await getMonthlyTrends(session.shop);
    const breakdown = await getOptimizationBreakdown(session.shop);

    // Build summary report CSV
    const lines = [
      "LatentSEO Monthly Summary Report",
      `Generated: ${new Date().toISOString()}`,
      `Shop: ${session.shop}`,
      "",
      "=== Overall Statistics ===",
      `Total Optimizations,${analytics.totalOptimizations}`,
      `Total Products Optimized,${analytics.totalProductsOptimized}`,
      `Total Jobs Run,${analytics.totalJobs}`,
      `SEO Health Score,${analytics.seoHealthScore}%`,
      "",
      "=== This Month ===",
      `Optimizations,${analytics.thisMonthOptimizations}`,
      `Products,${analytics.thisMonthProducts}`,
      `Jobs,${analytics.thisMonthJobs}`,
      "",
      "=== By Field Type ===",
      ...breakdown.map((b) => `${b.field},${b.count},${b.percentage}%`),
      "",
      "=== Monthly Trends ===",
      "Month,Optimizations,Products",
      ...monthlyTrends.map((t) => `${t.month},${t.optimizations},${t.products}`),
    ];

    return json({
      success: true,
      reportType: "monthly-summary",
      csv: lines.join("\n"),
      stats: {
        totalOptimizations: analytics.totalOptimizations,
        seoHealthScore: analytics.seoHealthScore,
      },
    });
  }

  return json({ success: false, error: "Invalid report type" });
};

const REPORT_TYPES = [
  {
    value: "seo-audit",
    label: "SEO Audit Report",
    description: "Complete SEO analysis of all products with scores and issues",
  },
  {
    value: "optimization-history",
    label: "Optimization History",
    description: "Full history of all SEO optimizations performed",
  },
  {
    value: "monthly-summary",
    label: "Monthly Summary",
    description: "Overview of optimization activity and trends",
  },
];

export default function ReportsPage() {
  const { analytics, monthlyTrends, breakdown } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [selectedReport, setSelectedReport] = useState("seo-audit");

  const handleExport = useCallback(() => {
    fetcher.submit({ reportType: selectedReport }, { method: "POST" });
  }, [fetcher, selectedReport]);

  // Handle download when export completes
  if (fetcher.data?.success && fetcher.data?.csv) {
    const blob = new Blob([fetcher.data.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fetcher.data.reportType}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    shopify.toast.show("Report downloaded successfully");
  }

  const isLoading = fetcher.state !== "idle";
  const selectedReportInfo = REPORT_TYPES.find((r) => r.value === selectedReport);

  return (
    <Page>
      <TitleBar title="Reports" />
      <BlockStack gap="500">
        {/* Analytics Overview */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Analytics Overview
            </Text>

            <Box
              padding="400"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd">
                    SEO Health Score
                  </Text>
                  <Text as="p" variant="headingMd">
                    {analytics.seoHealthScore}%
                  </Text>
                </InlineStack>
                <ProgressBar
                  progress={analytics.seoHealthScore}
                  tone={
                    analytics.seoHealthScore >= 80
                      ? "success"
                      : analytics.seoHealthScore >= 50
                      ? "warning"
                      : "critical"
                  }
                  size="small"
                />
              </BlockStack>
            </Box>

            <Divider />

            <InlineStack gap="400" wrap={false}>
              <Box minWidth="150px">
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg">
                    {analytics.totalOptimizations.toLocaleString()}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Total Optimizations
                  </Text>
                </BlockStack>
              </Box>
              <Box minWidth="150px">
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg">
                    {analytics.totalProductsOptimized.toLocaleString()}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Products Optimized
                  </Text>
                </BlockStack>
              </Box>
              <Box minWidth="150px">
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg">
                    {analytics.totalJobs.toLocaleString()}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Jobs Completed
                  </Text>
                </BlockStack>
              </Box>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* This Month Stats */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              This Month
            </Text>

            <InlineStack gap="400" wrap={false}>
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
                minWidth="120px"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg">
                    {analytics.thisMonthOptimizations}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Optimizations
                  </Text>
                </BlockStack>
              </Box>
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
                minWidth="120px"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg">
                    {analytics.thisMonthProducts}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Products
                  </Text>
                </BlockStack>
              </Box>
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
                minWidth="120px"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg">
                    {analytics.thisMonthJobs}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Jobs
                  </Text>
                </BlockStack>
              </Box>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Optimization Breakdown */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Optimization Breakdown
            </Text>

            {breakdown.length > 0 ? (
              <BlockStack gap="300">
                {breakdown.map((item) => (
                  <Box key={item.field}>
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd">
                        {item.field === "meta_title"
                          ? "Meta Titles"
                          : item.field === "meta_description"
                          ? "Meta Descriptions"
                          : item.field === "alt_text"
                          ? "Alt Text"
                          : item.field}
                      </Text>
                      <Text as="p" variant="bodyMd">
                        {item.count.toLocaleString()} ({item.percentage}%)
                      </Text>
                    </InlineStack>
                    <Box paddingBlockStart="100">
                      <ProgressBar progress={item.percentage} size="small" />
                    </Box>
                  </Box>
                ))}
              </BlockStack>
            ) : (
              <Text as="p" tone="subdued">
                No optimization data yet.
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Monthly Trends */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Monthly Trends (Last 6 Months)
            </Text>

            {monthlyTrends.length > 0 ? (
              <BlockStack gap="200">
                {monthlyTrends.map((month) => {
                  // Parse YYYY-MM format correctly without timezone issues
                  const [year, monthNum] = month.month.split("-").map(Number);
                  const monthName = new Date(year, monthNum - 1, 15).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  });
                  return (
                  <Box key={month.month} padding="200">
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd">
                        {monthName}
                      </Text>
                      <InlineStack gap="400">
                        <Text as="p" variant="bodySm" tone="subdued">
                          {month.optimizations} optimizations
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {month.products} products
                        </Text>
                      </InlineStack>
                    </InlineStack>
                  </Box>
                  );
                })}
              </BlockStack>
            ) : (
              <Text as="p" tone="subdued">
                No trend data yet.
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Export Reports */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Export Reports
            </Text>
            <Text as="p" tone="subdued">
              Download detailed reports for analysis or record-keeping.
            </Text>

            <Select
              label="Report Type"
              options={REPORT_TYPES.map((r) => ({
                label: r.label,
                value: r.value,
              }))}
              value={selectedReport}
              onChange={setSelectedReport}
            />

            {selectedReportInfo && (
              <Banner tone="info">
                <Text as="p">{selectedReportInfo.description}</Text>
              </Banner>
            )}

            <Button
              variant="primary"
              onClick={handleExport}
              loading={isLoading}
              disabled={isLoading}
            >
              Download CSV Report
            </Button>

            {fetcher.data?.stats && (
              <Box paddingBlockStart="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Report generated with {JSON.stringify(fetcher.data.stats)}
                </Text>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
