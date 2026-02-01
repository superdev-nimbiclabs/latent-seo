import {
  Card,
  BlockStack,
  InlineStack,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonThumbnail,
  Box,
  Layout,
} from "@shopify/polaris";

/**
 * Loading skeleton for the dashboard page
 */
export function DashboardSkeleton() {
  return (
    <BlockStack gap="500">
      {/* Stats Cards */}
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={1} />
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={1} />
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={1} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Quick Actions Card */}
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={2} />
          <InlineStack gap="200">
            <Box minWidth="120px">
              <SkeletonBodyText lines={1} />
            </Box>
            <Box minWidth="120px">
              <SkeletonBodyText lines={1} />
            </Box>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Recent Activity */}
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={5} />
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

/**
 * Loading skeleton for product list
 */
export function ProductListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Card>
      <BlockStack gap="400">
        {/* Filter bar skeleton */}
        <InlineStack gap="200">
          <Box minWidth="200px">
            <SkeletonBodyText lines={1} />
          </Box>
          <Box minWidth="150px">
            <SkeletonBodyText lines={1} />
          </Box>
        </InlineStack>

        {/* Product rows */}
        {Array.from({ length: count }).map((_, i) => (
          <ProductRowSkeleton key={i} />
        ))}
      </BlockStack>
    </Card>
  );
}

/**
 * Single product row skeleton
 */
export function ProductRowSkeleton() {
  return (
    <Box paddingBlock="200">
      <InlineStack gap="400" align="start" blockAlign="center">
        <SkeletonThumbnail size="small" />
        <Box minWidth="200px">
          <BlockStack gap="100">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={1} />
          </BlockStack>
        </Box>
        <Box minWidth="100px">
          <SkeletonBodyText lines={1} />
        </Box>
        <Box minWidth="80px">
          <SkeletonBodyText lines={1} />
        </Box>
      </InlineStack>
    </Box>
  );
}

/**
 * Loading skeleton for history/logs list
 */
export function HistoryListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <SkeletonDisplayText size="small" />
          <Box minWidth="100px">
            <SkeletonBodyText lines={1} />
          </Box>
        </InlineStack>

        {Array.from({ length: count }).map((_, i) => (
          <Box key={i} paddingBlock="200">
            <InlineStack gap="400">
              <Box minWidth="100px">
                <SkeletonBodyText lines={1} />
              </Box>
              <Box minWidth="150px">
                <SkeletonBodyText lines={1} />
              </Box>
              <Box minWidth="80px">
                <SkeletonBodyText lines={1} />
              </Box>
              <Box minWidth="60px">
                <SkeletonBodyText lines={1} />
              </Box>
            </InlineStack>
          </Box>
        ))}
      </BlockStack>
    </Card>
  );
}

/**
 * Loading skeleton for settings page
 */
export function SettingsSkeleton() {
  return (
    <BlockStack gap="500">
      {/* AI Settings Card */}
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={2} />
          <Box>
            <SkeletonBodyText lines={1} />
          </Box>
          <Box>
            <SkeletonBodyText lines={1} />
          </Box>
        </BlockStack>
      </Card>

      {/* Custom Prompts Card */}
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={2} />
          <SkeletonBodyText lines={3} />
          <SkeletonBodyText lines={3} />
          <SkeletonBodyText lines={3} />
        </BlockStack>
      </Card>

      {/* Plan Card */}
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={3} />
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

/**
 * Loading skeleton for jobs list
 */
export function JobsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Card>
      <BlockStack gap="400">
        <SkeletonDisplayText size="small" />

        {Array.from({ length: count }).map((_, i) => (
          <Box key={i} paddingBlock="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <SkeletonDisplayText size="small" />
                <Box minWidth="80px">
                  <SkeletonBodyText lines={1} />
                </Box>
              </InlineStack>
              <SkeletonBodyText lines={1} />
            </BlockStack>
          </Box>
        ))}
      </BlockStack>
    </Card>
  );
}

/**
 * Loading skeleton for SEO audit page
 */
export function AuditSkeleton() {
  return (
    <BlockStack gap="500">
      {/* Score overview */}
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <SkeletonDisplayText size="medium" />
              <SkeletonBodyText lines={2} />
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="300">
              <SkeletonDisplayText size="medium" />
              <SkeletonBodyText lines={2} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Product list */}
      <ProductListSkeleton count={8} />
    </BlockStack>
  );
}

/**
 * Generic card skeleton
 */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <BlockStack gap="400">
        <SkeletonDisplayText size="small" />
        <SkeletonBodyText lines={lines} />
      </BlockStack>
    </Card>
  );
}

/**
 * Page-level skeleton with title
 */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <BlockStack gap="500">
      <Box paddingBlockEnd="200">
        <SkeletonDisplayText size="large" />
      </Box>
      {children}
    </BlockStack>
  );
}
