import { InlineStack, Button, Text, Box } from "@shopify/polaris";

interface BulkActionBarProps {
  selectedCount: number;
  onGenerateMeta: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onGenerateMeta,
  onClearSelection,
  isLoading = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <Box
      padding="400"
      background="bg-surface-secondary"
      borderRadius="200"
    >
      <InlineStack align="space-between" blockAlign="center">
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {selectedCount} product{selectedCount !== 1 ? "s" : ""} selected
        </Text>
        <InlineStack gap="200">
          <Button
            onClick={onGenerateMeta}
            loading={isLoading}
            disabled={isLoading}
          >
            Optimize SEO
          </Button>
          <Button variant="plain" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </InlineStack>
      </InlineStack>
    </Box>
  );
}
