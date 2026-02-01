import { Card, Text, BlockStack, InlineGrid } from "@shopify/polaris";
import type { ProductCounts } from "../../types/seo";

interface DashboardStatsProps {
  counts: ProductCounts;
}

export function DashboardStats({ counts }: DashboardStatsProps) {
  const stats = [
    {
      title: "Total Products",
      value: counts.total,
      description: "Products in your store",
    },
    {
      title: "Missing Title",
      value: counts.missingTitle,
      description: "Need SEO title",
      tone: counts.missingTitle > 0 ? "warning" : "success",
    },
    {
      title: "Missing Description",
      value: counts.missingMeta,
      description: "Need SEO description",
      tone: counts.missingMeta > 0 ? "critical" : "success",
    },
    {
      title: "Fully Optimized",
      value: counts.optimized,
      description: "Complete SEO setup",
      tone: "success",
    },
  ];

  return (
    <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm" tone="subdued">
              {stat.title}
            </Text>
            <Text
              as="p"
              variant="heading2xl"
              fontWeight="bold"
              tone={stat.tone as any}
            >
              {stat.value.toLocaleString()}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {stat.description}
            </Text>
          </BlockStack>
        </Card>
      ))}
    </InlineGrid>
  );
}
