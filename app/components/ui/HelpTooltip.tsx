import { Tooltip, Icon, InlineStack, Text, Box } from "@shopify/polaris";
import { QuestionCircleIcon } from "@shopify/polaris-icons";

interface HelpTooltipProps {
  content: string;
  preferredPosition?: "above" | "below" | "mostSpace";
}

/**
 * Inline help tooltip with question mark icon
 */
export function HelpTooltip({
  content,
  preferredPosition = "above",
}: HelpTooltipProps) {
  return (
    <Tooltip content={content} preferredPosition={preferredPosition}>
      <span style={{ cursor: "help" }}>
        <Icon source={QuestionCircleIcon} tone="subdued" />
      </span>
    </Tooltip>
  );
}

interface LabelWithHelpProps {
  label: string;
  help: string;
}

/**
 * Label with inline help tooltip
 */
export function LabelWithHelp({ label, help }: LabelWithHelpProps) {
  return (
    <InlineStack gap="100" align="start" blockAlign="center">
      <Text as="span">{label}</Text>
      <HelpTooltip content={help} />
    </InlineStack>
  );
}

/**
 * Common help text definitions used throughout the app
 */
export const HELP_TEXT = {
  // SEO Fields
  metaTitle: "The SEO title appears in search results. Keep it under 60 characters for best results.",
  metaDescription: "The meta description appears in search results below the title. Aim for 130-160 characters.",
  altText: "Alt text describes images for screen readers and search engines. Keep it descriptive but under 125 characters.",

  // AI Settings
  aiTone: "The tone affects how AI writes your SEO content. Professional is best for most stores.",
  autoPublish: "When enabled, AI-generated content is applied immediately. When disabled, changes queue for review.",
  customPrompt: "Add specific instructions for AI to follow when generating content for your store.",

  // Plan & Billing
  productLimit: "The number of products you can optimize each billing month. Resets on your billing date.",
  usageTracking: "We track products optimized (not individual fields) to count against your limit.",

  // Jobs
  bulkOptimize: "Optimizes all products missing SEO data in one batch job.",
  jobProgress: "Jobs process products one at a time. Large catalogs may take several minutes.",
  undoChanges: "Revert any AI-generated content back to the previous value.",

  // Schema
  schemaMarkup: "Structured data helps Google understand your content and can enable rich results in search.",
  breadcrumbs: "Shows navigation path in search results (Home > Category > Product).",
  organizationSchema: "Adds your business info to Google's Knowledge Panel.",

  // Exclusions
  excludedTags: "Products with these tags will be skipped during bulk optimization.",
  excludedCollections: "Products in these collections will be skipped during bulk optimization.",

  // Notifications
  notifyOnComplete: "Receive a notification when bulk optimization jobs finish.",

  // API Keys
  customApiKey: "Use your own Gemini API key to avoid shared rate limits.",
} as const;

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Informational card with light styling
 */
export function InfoCard({ title, children }: InfoCardProps) {
  return (
    <Box
      padding="400"
      background="bg-surface-secondary"
      borderRadius="200"
    >
      <InlineStack gap="200" align="start" blockAlign="start">
        <Box>
          <Icon source={QuestionCircleIcon} tone="info" />
        </Box>
        <Box>
          <Text as="h4" variant="headingSm">
            {title}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {children}
          </Text>
        </Box>
      </InlineStack>
    </Box>
  );
}

/**
 * Keyboard shortcut display
 */
export function KeyboardShortcut({ keys }: { keys: string[] }) {
  return (
    <InlineStack gap="100">
      {keys.map((key, i) => (
        <span key={i}>
          <Box
            padding="100"
            background="bg-surface-secondary"
            borderRadius="100"
          >
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {key}
            </Text>
          </Box>
          {i < keys.length - 1 && (
            <Text as="span" variant="bodySm" tone="subdued">
              {" + "}
            </Text>
          )}
        </span>
      ))}
    </InlineStack>
  );
}

/**
 * Keyboard shortcuts reference
 */
export const KEYBOARD_SHORTCUTS = {
  selectAll: { keys: ["Ctrl", "A"], description: "Select all products" },
  deselectAll: { keys: ["Esc"], description: "Deselect all" },
  search: { keys: ["Ctrl", "K"], description: "Focus search" },
  save: { keys: ["Ctrl", "S"], description: "Save changes" },
  refresh: { keys: ["Ctrl", "R"], description: "Refresh data" },
} as const;
