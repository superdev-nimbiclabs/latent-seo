import { Banner, ProgressBar, Text, BlockStack } from "@shopify/polaris";
import type { ActiveJob } from "../../types/seo";

interface JobProgressBannerProps {
  job: ActiveJob;
  onDismiss?: () => void;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  META_DESCRIPTION: "SEO titles and descriptions",
  ALT_TEXT: "image alt text",
  SCHEMA_INJECTION: "schema markup",
};

export function JobProgressBanner({ job, onDismiss }: JobProgressBannerProps) {
  const progress = job.total > 0 ? (job.processed / job.total) * 100 : 0;
  const jobTypeLabel = JOB_TYPE_LABELS[job.type] || job.type;

  if (job.status === "COMPLETED") {
    return (
      <Banner
        title="Optimization Complete"
        tone="success"
        onDismiss={onDismiss}
      >
        <Text as="p">
          Successfully optimized {jobTypeLabel} for {job.total} products.
        </Text>
      </Banner>
    );
  }

  if (job.status === "FAILED") {
    return (
      <Banner
        title="Optimization Failed"
        tone="critical"
        onDismiss={onDismiss}
      >
        <Text as="p">
          Failed to optimize {jobTypeLabel}. Please try again.
        </Text>
      </Banner>
    );
  }

  // Still counting products
  if (job.total === 0) {
    return (
      <Banner title="Optimization Starting" tone="info">
        <BlockStack gap="300">
          <Text as="p">
            Scanning products for {jobTypeLabel} optimization...
          </Text>
          <ProgressBar progress={10} size="small" />
        </BlockStack>
      </Banner>
    );
  }

  return (
    <Banner title="Optimization in Progress" tone="info">
      <BlockStack gap="300">
        <Text as="p">
          Optimizing {jobTypeLabel} for {job.processed} of {job.total} products...
        </Text>
        <ProgressBar progress={progress} size="small" />
      </BlockStack>
    </Banner>
  );
}
