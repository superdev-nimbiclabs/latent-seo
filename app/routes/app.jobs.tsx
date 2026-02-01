import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Badge,
  Box,
  InlineStack,
  DataTable,
  EmptyState,
  ProgressBar,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

const JOB_TYPE_LABELS: Record<string, string> = {
  META_DESCRIPTION: "SEO Optimization",
  ALT_TEXT: "Alt Text Generation",
  SCHEMA_INJECTION: "Schema Markup",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Fetch all jobs for this shop
  const jobs = await prisma.job.findMany({
    where: { shopDomain: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Get counts by status
  const stats = {
    pending: jobs.filter((j) => j.status === "PENDING").length,
    processing: jobs.filter((j) => j.status === "PROCESSING").length,
    completed: jobs.filter((j) => j.status === "COMPLETED").length,
    failed: jobs.filter((j) => j.status === "FAILED").length,
  };

  // Check if any job is currently running
  const hasActiveJob = stats.processing > 0 || stats.pending > 0;

  return json({
    jobs,
    stats,
    hasActiveJob,
  });
};

function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: Date, end: Date | null): string {
  if (!end) return "In progress...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return <Badge tone="success">Completed</Badge>;
    case "PROCESSING":
      return <Badge tone="attention">Processing</Badge>;
    case "PENDING":
      return <Badge tone="info">Pending</Badge>;
    case "FAILED":
      return <Badge tone="critical">Failed</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

export default function JobsPage() {
  const { jobs, stats, hasActiveJob } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  // Auto-refresh when jobs are active
  useEffect(() => {
    if (!hasActiveJob) return;

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 3000);

    return () => clearInterval(interval);
  }, [hasActiveJob, revalidator]);

  // Build table rows
  const rows = jobs.map((job) => [
    formatDate(job.createdAt),
    JOB_TYPE_LABELS[job.type] || job.type,
    <StatusBadge key={job.id} status={job.status} />,
    job.status === "PROCESSING" ? (
      <Box minWidth="100px">
        <BlockStack gap="100">
          <Text as="span" variant="bodySm">
            {job.processedItems} / {job.totalItems || "?"}
          </Text>
          <ProgressBar
            progress={job.totalItems ? (job.processedItems / job.totalItems) * 100 : 10}
            size="small"
          />
        </BlockStack>
      </Box>
    ) : (
      `${job.processedItems} / ${job.totalItems}`
    ),
    formatDuration(job.createdAt, job.completedAt),
  ]);

  return (
    <Page>
      <TitleBar title="Jobs" />
      <BlockStack gap="500">
        {/* Stats Overview */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Job Statistics
            </Text>

            <InlineStack gap="400" wrap={false}>
              <Box
                padding="400"
                background="bg-surface-secondary"
                borderRadius="200"
                minWidth="120px"
              >
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg" tone="success">
                    {stats.completed}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Completed
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
                  <Text as="p" variant="headingLg" tone="caution">
                    {stats.processing}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Processing
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
                    {stats.pending}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Pending
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
                  <Text as="p" variant="headingLg" tone="critical">
                    {stats.failed}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Failed
                  </Text>
                </BlockStack>
              </Box>
            </InlineStack>

            {hasActiveJob && (
              <Text as="p" tone="subdued">
                Auto-refreshing every 3 seconds...
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* Jobs Table */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                Recent Jobs
              </Text>
              <Button
                variant="plain"
                onClick={() => revalidator.revalidate()}
                loading={revalidator.state === "loading"}
              >
                Refresh
              </Button>
            </InlineStack>

            {jobs.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text"]}
                headings={["Date", "Type", "Status", "Progress", "Duration"]}
                rows={rows}
              />
            ) : (
              <Box paddingBlock="600">
                <EmptyState heading="No jobs yet" image="">
                  <Text as="p" tone="subdued">
                    Start an optimization from the Dashboard to see jobs here.
                  </Text>
                </EmptyState>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
