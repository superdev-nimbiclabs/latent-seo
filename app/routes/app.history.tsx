import { useCallback, useState } from "react";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Text,
  Badge,
  BlockStack,
  Box,
  Pagination,
  EmptyState,
  Button,
  InlineStack,
  Tooltip,
  Select,
  Modal,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getOptimizationHistory,
  revertOptimization,
  revertJob,
} from "../services/undo.server";
import { prisma } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const showReverted = url.searchParams.get("showReverted") !== "false";
  const jobId = url.searchParams.get("jobId") || undefined;

  // Fetch logs with optional job filter
  const { logs, pagination } = await getOptimizationHistory(session.shop, {
    page,
    limit: 20,
    showReverted,
    jobId,
  });

  // Fetch recent jobs for the filter dropdown
  const recentJobs = await prisma.job.findMany({
    where: { shopDomain: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      createdAt: true,
      processedItems: true,
      status: true,
    },
  });

  // Get count of non-reverted logs for current filter (for bulk undo)
  const activeLogsCount = await prisma.optimizationLog.count({
    where: {
      shopDomain: session.shop,
      isReverted: false,
      ...(jobId ? { jobId } : {}),
    },
  });

  return json({
    logs,
    pagination,
    showReverted,
    recentJobs,
    selectedJobId: jobId || null,
    activeLogsCount,
    shopDomain: session.shop,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "revert") {
    const logId = formData.get("logId") as string;

    try {
      const result = await revertOptimization(logId, session.shop);
      return json({ revertSuccess: true, ...result });
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to revert",
      });
    }
  }

  if (intent === "revertJob") {
    const jobId = formData.get("jobId") as string;

    try {
      const result = await revertJob(jobId, session.shop);
      return json({ bulkRevertSuccess: true, ...result });
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to bulk revert",
      });
    }
  }

  if (intent === "export") {
    const jobId = formData.get("jobId") as string | null;

    // Fetch all logs for export (no pagination)
    const logs = await prisma.optimizationLog.findMany({
      where: {
        shopDomain: session.shop,
        ...(jobId ? { jobId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        job: {
          select: { type: true },
        },
      },
    });

    // Build CSV content
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

    const escapeCSV = (value: string | null): string => {
      if (!value) return "";
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
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

    return json({ exportSuccess: true, csv, count: logs.length });
  }

  return json({ success: false, error: "Invalid intent" });
};

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

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

function formatProductId(productId: string): string {
  return productId.replace("gid://shopify/Product/", "#");
}

const FIELD_LABELS: Record<string, string> = {
  meta_description: "Meta Description",
  meta_title: "Meta Title",
  alt_text: "Alt Text",
  schema: "Schema",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  META_DESCRIPTION: "SEO",
  ALT_TEXT: "Alt Text",
  SCHEMA_INJECTION: "Schema",
};

export default function HistoryPage() {
  const {
    logs,
    pagination,
    showReverted,
    recentJobs,
    selectedJobId,
    activeLogsCount,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showBulkUndoModal, setShowBulkUndoModal] = useState(false);

  const isLoading = fetcher.state !== "idle";

  // Handle export result
  const exportResult = fetcher.data && "exportSuccess" in fetcher.data && fetcher.data.exportSuccess;
  const bulkRevertResult = fetcher.data && "bulkRevertSuccess" in fetcher.data;

  const handleRevert = useCallback(
    (logId: string) => {
      fetcher.submit({ intent: "revert", logId }, { method: "POST" });
    },
    [fetcher]
  );

  const handleBulkRevert = useCallback(() => {
    if (!selectedJobId) return;
    fetcher.submit({ intent: "revertJob", jobId: selectedJobId }, { method: "POST" });
    setShowBulkUndoModal(false);
  }, [fetcher, selectedJobId]);

  const handleExport = useCallback(() => {
    fetcher.submit(
      { intent: "export", ...(selectedJobId ? { jobId: selectedJobId } : {}) },
      { method: "POST" }
    );
  }, [fetcher, selectedJobId]);

  // Download CSV when export completes
  if (exportResult && fetcher.data && "csv" in fetcher.data) {
    const blob = new Blob([fetcher.data.csv as string], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seo-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set("page", String(newPage));
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleJobFilterChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value === "") {
        params.delete("jobId");
      } else {
        params.set("jobId", value);
      }
      params.delete("page"); // Reset to first page
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const toggleShowReverted = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    if (showReverted) {
      params.set("showReverted", "false");
    } else {
      params.delete("showReverted");
    }
    params.delete("page"); // Reset to first page
    setSearchParams(params);
  }, [searchParams, setSearchParams, showReverted]);

  // Build job filter options
  const jobFilterOptions = [
    { label: "All Jobs", value: "" },
    ...recentJobs.map((job) => ({
      label: `${JOB_TYPE_LABELS[job.type] || job.type} - ${formatDate(job.createdAt)} (${job.processedItems} items)`,
      value: job.id,
    })),
  ];

  // Build table rows
  const rows = logs.map((log) => [
    formatDate(log.createdAt),
    formatProductId(log.productId),
    FIELD_LABELS[log.field] || log.field,
    <Tooltip content={log.oldValue || "Empty"} key={`old-${log.id}`}>
      <Text as="span" variant="bodySm" tone="subdued">
        {truncateText(log.oldValue, 30)}
      </Text>
    </Tooltip>,
    <Tooltip content={log.newValue} key={`new-${log.id}`}>
      <Text as="span" variant="bodySm">
        {truncateText(log.newValue, 30)}
      </Text>
    </Tooltip>,
    log.isReverted ? (
      <Badge tone="warning">Reverted</Badge>
    ) : (
      <Button
        variant="plain"
        onClick={() => handleRevert(log.id)}
        loading={isLoading}
        disabled={isLoading}
      >
        Undo
      </Button>
    ),
  ]);

  return (
    <Page>
      <TitleBar title="Optimization History" />
      <BlockStack gap="400">
        {/* Bulk revert result banner */}
        {bulkRevertResult && fetcher.data && "reverted" in fetcher.data && (
          <Banner
            title="Bulk Undo Complete"
            tone={fetcher.data.success ? "success" : "warning"}
            onDismiss={() => {}}
          >
            <Text as="p">
              Reverted {fetcher.data.reverted} of {fetcher.data.total} optimizations.
              {fetcher.data.errors && (fetcher.data.errors as string[]).length > 0 && (
                <> Some errors occurred.</>
              )}
            </Text>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            {/* Header with filter and actions */}
            <InlineStack align="space-between" wrap={false}>
              <Text as="h2" variant="headingMd">
                Recent Optimizations
              </Text>
              <InlineStack gap="200">
                <Button variant="plain" onClick={toggleShowReverted}>
                  {showReverted ? "Hide reverted" : "Show reverted"}
                </Button>
              </InlineStack>
            </InlineStack>

            {/* Filter and bulk actions row */}
            <InlineStack gap="300" align="space-between" wrap={false}>
              <Box minWidth="300px">
                <Select
                  label="Filter by job"
                  labelHidden
                  options={jobFilterOptions}
                  value={selectedJobId || ""}
                  onChange={handleJobFilterChange}
                />
              </Box>
              <InlineStack gap="200">
                {selectedJobId && activeLogsCount > 0 && (
                  <Button
                    variant="secondary"
                    tone="critical"
                    onClick={() => setShowBulkUndoModal(true)}
                    disabled={isLoading}
                  >
                    Undo All ({activeLogsCount})
                  </Button>
                )}
                <Button onClick={handleExport} loading={isLoading} disabled={isLoading}>
                  Export CSV
                </Button>
              </InlineStack>
            </InlineStack>

            {logs.length > 0 ? (
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "Date",
                  "Product",
                  "Field",
                  "Old Value",
                  "New Value",
                  "Actions",
                ]}
                rows={rows}
              />
            ) : (
              <Box paddingBlock="600">
                <EmptyState
                  heading="No optimization history"
                  image=""
                >
                  <Text as="p" tone="subdued">
                    {showReverted
                      ? "Start optimizing products to see history here."
                      : "No active optimizations found. Try showing reverted items."}
                  </Text>
                </EmptyState>
              </Box>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Box paddingBlockStart="400">
                <InlineStack align="center" gap="200">
                  <Pagination
                    hasPrevious={pagination.page > 1}
                    hasNext={pagination.page < pagination.totalPages}
                    onPrevious={() => handlePageChange(pagination.page - 1)}
                    onNext={() => handlePageChange(pagination.page + 1)}
                  />
                  <Text as="span" variant="bodySm" tone="subdued">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </Text>
                </InlineStack>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>

      {/* Bulk Undo Confirmation Modal */}
      <Modal
        open={showBulkUndoModal}
        onClose={() => setShowBulkUndoModal(false)}
        title="Undo All Optimizations"
        primaryAction={{
          content: `Undo ${activeLogsCount} changes`,
          destructive: true,
          onAction: handleBulkRevert,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowBulkUndoModal(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            This will revert all {activeLogsCount} active optimizations from this job.
            The original values will be restored in Shopify. This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
