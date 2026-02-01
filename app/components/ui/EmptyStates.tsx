import {
  Card,
  BlockStack,
  Text,
  Button,
  Box,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import {
  SearchIcon,
  ProductIcon,
  ClockIcon,
  CheckCircleIcon,
  SettingsIcon,
  ChartVerticalIcon,
} from "@shopify/polaris-icons";

interface EmptyStateProps {
  heading: string;
  description: string;
  icon?: React.ComponentType;
  action?: {
    label: string;
    url?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    url?: string;
    onClick?: () => void;
  };
}

/**
 * Generic empty state component
 */
export function EmptyStateCard({
  heading,
  description,
  icon: IconComponent,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <Card>
      <Box padding="800">
        <BlockStack gap="400" inlineAlign="center">
          {IconComponent && (
            <Box>
              <Icon source={IconComponent} tone="subdued" />
            </Box>
          )}
          <BlockStack gap="200" inlineAlign="center">
            <Text as="h2" variant="headingMd">
              {heading}
            </Text>
            <Text as="p" tone="subdued" alignment="center">
              {description}
            </Text>
          </BlockStack>
          <InlineStack gap="200">
            {action && (
              <Button
                variant="primary"
                url={action.url}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant="plain"
                url={secondaryAction.url}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )}
          </InlineStack>
        </BlockStack>
      </Box>
    </Card>
  );
}

/**
 * No products found (after filtering)
 */
export function NoProductsFound({
  onClearFilters,
}: {
  onClearFilters?: () => void;
}) {
  return (
    <EmptyStateCard
      heading="No products found"
      description="Try adjusting your filters or search terms to find what you're looking for."
      icon={SearchIcon}
      action={
        onClearFilters
          ? {
              label: "Clear filters",
              onClick: onClearFilters,
            }
          : undefined
      }
    />
  );
}

/**
 * No products in store
 */
export function NoProductsInStore() {
  return (
    <EmptyStateCard
      heading="No products yet"
      description="Add products to your store to start optimizing their SEO."
      icon={ProductIcon}
      action={{
        label: "Add products",
        url: "shopify://admin/products/new",
      }}
      secondaryAction={{
        label: "Import products",
        url: "shopify://admin/products?selectedView=import",
      }}
    />
  );
}

/**
 * No optimization history
 */
export function NoHistory() {
  return (
    <EmptyStateCard
      heading="No optimization history"
      description="Your optimization history will appear here once you start optimizing products."
      icon={ClockIcon}
      action={{
        label: "Optimize products",
        url: "/app/products",
      }}
    />
  );
}

/**
 * No pending jobs
 */
export function NoJobs() {
  return (
    <EmptyStateCard
      heading="No pending jobs"
      description="All optimization jobs have been completed. Start a new job from the dashboard."
      icon={CheckCircleIcon}
      action={{
        label: "Go to dashboard",
        url: "/app",
      }}
    />
  );
}

/**
 * All products optimized
 */
export function AllProductsOptimized() {
  return (
    <EmptyStateCard
      heading="All products optimized"
      description="Great job! All your products have complete SEO data. Check back when you add new products."
      icon={CheckCircleIcon}
      action={{
        label: "View products",
        url: "/app/products",
      }}
      secondaryAction={{
        label: "Run SEO audit",
        url: "/app/audit",
      }}
    />
  );
}

/**
 * No audit issues found
 */
export function NoAuditIssues() {
  return (
    <EmptyStateCard
      heading="No SEO issues found"
      description="Your store's SEO is in great shape! All products have complete and optimized SEO data."
      icon={CheckCircleIcon}
    />
  );
}

/**
 * Settings not configured
 */
export function SettingsNotConfigured() {
  return (
    <EmptyStateCard
      heading="Configure your settings"
      description="Set up your AI preferences to get the best results from LatentSEO."
      icon={SettingsIcon}
      action={{
        label: "Go to settings",
        url: "/app/settings",
      }}
    />
  );
}

/**
 * No usage data yet
 */
export function NoUsageData() {
  return (
    <EmptyStateCard
      heading="No usage data yet"
      description="Your usage statistics will appear here once you start optimizing products."
      icon={ChartVerticalIcon}
      action={{
        label: "Start optimizing",
        url: "/app",
      }}
    />
  );
}

/**
 * Search results empty
 */
export function NoSearchResults({ query }: { query: string }) {
  return (
    <Box padding="400">
      <BlockStack gap="200" inlineAlign="center">
        <Icon source={SearchIcon} tone="subdued" />
        <Text as="p" tone="subdued" alignment="center">
          No results for "{query}"
        </Text>
      </BlockStack>
    </Box>
  );
}

/**
 * Filter yields no results
 */
export function FilterNoResults({
  filterName,
  onClear,
}: {
  filterName?: string;
  onClear?: () => void;
}) {
  return (
    <Box padding="400">
      <BlockStack gap="300" inlineAlign="center">
        <Text as="p" tone="subdued" alignment="center">
          No products match {filterName ? `the "${filterName}" filter` : "the current filters"}.
        </Text>
        {onClear && (
          <Button variant="plain" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </BlockStack>
    </Box>
  );
}
