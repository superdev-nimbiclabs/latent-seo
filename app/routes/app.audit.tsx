import { useCallback, useEffect } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Badge,
  Box,
  InlineStack,
  Button,
  Collapsible,
  List,
  ProgressBar,
  EmptyState,
  Divider,
  InlineGrid,
  Banner,
  Icon,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { CheckCircleIcon } from "@shopify/polaris-icons";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { auditProducts } from "../services/seo-audit.server";
import { getScoreLabel, type SeoAuditResult } from "../services/seo-audit.shared";
import { addSeoFixJob } from "../lib/queue.server";

// GraphQL query to fetch products with SEO data
const PRODUCTS_QUERY = `#graphql
  query GetProductsForAudit($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          descriptionHtml
          seo {
            title
            description
          }
          images(first: 10) {
            edges {
              node {
                id
                url
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

interface ShopifyProduct {
  id: string;
  title: string;
  descriptionHtml: string | null;
  seo: {
    title: string | null;
    description: string | null;
  };
  images: {
    edges: Array<{
      node: {
        id: string;
        url: string;
        altText: string | null;
      };
    }>;
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch all products for audit
  const allProducts: ShopifyProduct[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: { cursor },
    });

    const data = await response.json();
    const products = data.data.products.edges.map((e: { node: ShopifyProduct }) => e.node);
    allProducts.push(...products);

    hasNextPage = data.data.products.pageInfo.hasNextPage;
    cursor = data.data.products.pageInfo.endCursor;

    // Limit to 250 products for performance
    if (allProducts.length >= 250) break;
  }

  // Transform for audit
  const productsForAudit = allProducts.map((p) => ({
    id: p.id,
    title: p.title,
    descriptionHtml: p.descriptionHtml,
    seo: p.seo,
    images: p.images.edges.map((e) => e.node),
  }));

  const { results, stats } = auditProducts(productsForAudit);

  // Sort by score (worst first)
  results.sort((a, b) => a.score - b.score);

  return json({
    results,
    stats,
    shopDomain: session.shop,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "fix-meta") {
    const jobId = await addSeoFixJob({
      shopDomain: session.shop,
      jobType: "META_DESCRIPTION",
    });
    return json({ success: true, jobId, type: "META_DESCRIPTION" });
  }

  if (intent === "fix-alt") {
    const jobId = await addSeoFixJob({
      shopDomain: session.shop,
      jobType: "ALT_TEXT",
    });
    return json({ success: true, jobId, type: "ALT_TEXT" });
  }

  return json({ success: false, error: "Invalid intent" });
};

function ScoreBadge({ score }: { score: number }) {
  const { label, tone } = getScoreLabel(score);
  return (
    <Badge tone={tone === "critical" ? "critical" : tone === "warning" ? "warning" : "success"}>
      {score}/100 - {label}
    </Badge>
  );
}

function ProductAuditCard({ result }: { result: SeoAuditResult }) {
  const [open, setOpen] = useState(false);

  const criticalIssues = result.issues.filter((i) => i.severity === "critical");
  const warningIssues = result.issues.filter((i) => i.severity === "warning");
  const infoIssues = result.issues.filter((i) => i.severity === "info");

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="h3" variant="headingMd">
              {result.productTitle}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {result.productId.replace("gid://shopify/Product/", "#")}
            </Text>
          </BlockStack>
          <InlineStack gap="200" blockAlign="center">
            <ScoreBadge score={result.score} />
            <Button
              variant="plain"
              onClick={() => setOpen(!open)}
              ariaExpanded={open}
            >
              {open ? "Hide details" : "Show details"}
            </Button>
          </InlineStack>
        </InlineStack>

        <Collapsible open={open} id={`audit-${result.productId}`}>
          <Box paddingBlockStart="300">
            <BlockStack gap="300">
              {criticalIssues.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h4" variant="headingSm" tone="critical">
                    Critical Issues
                  </Text>
                  <List type="bullet">
                    {criticalIssues.map((issue, i) => (
                      <List.Item key={i}>
                        <Text as="span" fontWeight="semibold">
                          {issue.message}
                        </Text>
                        {issue.recommendation && (
                          <Text as="p" variant="bodySm" tone="subdued">
                            {issue.recommendation}
                          </Text>
                        )}
                      </List.Item>
                    ))}
                  </List>
                </BlockStack>
              )}

              {warningIssues.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h4" variant="headingSm" tone="caution">
                    Warnings
                  </Text>
                  <List type="bullet">
                    {warningIssues.map((issue, i) => (
                      <List.Item key={i}>
                        <Text as="span" fontWeight="semibold">
                          {issue.message}
                        </Text>
                        {issue.recommendation && (
                          <Text as="p" variant="bodySm" tone="subdued">
                            {issue.recommendation}
                          </Text>
                        )}
                      </List.Item>
                    ))}
                  </List>
                </BlockStack>
              )}

              {infoIssues.length > 0 && (
                <BlockStack gap="200">
                  <Text as="h4" variant="headingSm">
                    Suggestions
                  </Text>
                  <List type="bullet">
                    {infoIssues.map((issue, i) => (
                      <List.Item key={i}>
                        {issue.message}
                        {issue.recommendation && (
                          <Text as="span" tone="subdued">
                            {" "}
                            - {issue.recommendation}
                          </Text>
                        )}
                      </List.Item>
                    ))}
                  </List>
                </BlockStack>
              )}

              {result.issues.length === 0 && (
                <Text as="p" tone="success">
                  No issues found - this product is fully optimized!
                </Text>
              )}
            </BlockStack>
          </Box>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}

export default function AuditPage() {
  const { results, stats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const handleFixMeta = useCallback(() => {
    fetcher.submit({ intent: "fix-meta" }, { method: "POST" });
  }, [fetcher]);

  const handleFixAlt = useCallback(() => {
    fetcher.submit({ intent: "fix-alt" }, { method: "POST" });
  }, [fetcher]);

  // Toast notification when job starts
  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Optimization job started! Check the dashboard for progress.");
    }
  }, [fetcher.data, shopify]);

  const isLoading = fetcher.state !== "idle";
  const scoreColor =
    stats.avgScore >= 80 ? "success" : stats.avgScore >= 50 ? "warning" : "critical";

  // Products with critical issues
  const criticalProducts = results.filter((r) =>
    r.issues.some((i) => i.severity === "critical")
  );

  // All products are fully optimized
  const allOptimized = stats.avgScore === 100 && stats.criticalCount === 0;

  return (
    <Page>
      <TitleBar title="SEO Audit" />
      <BlockStack gap="500">
        {/* All Optimized Banner */}
        {allOptimized && (
          <Banner
            title="All products are fully optimized!"
            tone="success"
          >
            <InlineStack gap="200" blockAlign="center">
              <Icon source={CheckCircleIcon} />
              <Text as="p">
                Great job! Your store's SEO is in excellent shape. All products have complete meta titles, descriptions, and image alt text.
              </Text>
            </InlineStack>
          </Banner>
        )}

        {/* Store Overview */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Store SEO Health
            </Text>

            <InlineGrid columns={4} gap="400">
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg">
                    {stats.avgScore}%
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Average Score
                  </Text>
                </BlockStack>
              </Box>

              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg">
                    {stats.totalProducts}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Total Products
                  </Text>
                </BlockStack>
              </Box>

              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg" tone="critical">
                    {stats.criticalCount}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Critical Issues
                  </Text>
                </BlockStack>
              </Box>

              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg" tone="success">
                    {stats.optimizedCount}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Fully Optimized
                  </Text>
                </BlockStack>
              </Box>
            </InlineGrid>

            <Box paddingBlockStart="200">
              <ProgressBar
                progress={stats.avgScore}
                tone={scoreColor}
                size="small"
              />
            </Box>
          </BlockStack>
        </Card>

        {/* Quick Actions */}
        {stats.criticalCount > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Quick Fixes
              </Text>
              <Text as="p" tone="subdued">
                Automatically fix SEO issues across your store
              </Text>
              <InlineStack gap="200">
                <Button
                  onClick={handleFixMeta}
                  loading={isLoading && fetcher.formData?.get("intent") === "fix-meta"}
                  disabled={isLoading}
                >
                  Fix Missing Meta ({results.filter((r) =>
                    r.issues.some((i) => i.field === "metaTitle" || i.field === "metaDescription")
                  ).length} products)
                </Button>
                <Button
                  onClick={handleFixAlt}
                  loading={isLoading && fetcher.formData?.get("intent") === "fix-alt"}
                  disabled={isLoading}
                >
                  Fix Missing Alt Text ({results.filter((r) =>
                    r.issues.some((i) => i.field === "altText" && i.severity !== "info")
                  ).length} products)
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Product List */}
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Products ({results.length})
          </Text>

          {results.length === 0 ? (
            <Card>
              <EmptyState
                heading="No products found"
                image=""
              >
                <Text as="p" tone="subdued">
                  Add products to your store to see SEO audit results.
                </Text>
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="300">
              {results.slice(0, 50).map((result) => (
                <ProductAuditCard key={result.productId} result={result} />
              ))}
              {results.length > 50 && (
                <Card>
                  <Text as="p" tone="subdued">
                    Showing first 50 products. Visit the Products page to see all products.
                  </Text>
                </Card>
              )}
            </BlockStack>
          )}
        </BlockStack>
      </BlockStack>
    </Page>
  );
}
