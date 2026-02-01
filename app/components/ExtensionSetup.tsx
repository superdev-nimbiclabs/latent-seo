import {
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Box,
  Badge,
  Icon,
  Divider,
  List,
  Banner,
} from "@shopify/polaris";
import { CheckIcon, ExternalIcon } from "@shopify/polaris-icons";

interface ExtensionSetupProps {
  shopDomain: string;
  themeId?: string;
  isEnabled?: boolean;
}

export function ExtensionSetup({
  shopDomain,
  themeId,
  isEnabled = false,
}: ExtensionSetupProps) {
  // Build the theme editor URL for the extension
  const themeEditorUrl = themeId
    ? `https://${shopDomain}/admin/themes/${themeId}/editor`
    : `https://${shopDomain}/admin/themes`;

  const appBlockUrl = themeId
    ? `https://${shopDomain}/admin/themes/${themeId}/editor?context=apps`
    : themeEditorUrl;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Schema Markup Extension
            </Text>
            <Text as="p" tone="subdued">
              Automatically inject structured data for Google rich results
            </Text>
          </BlockStack>
          {isEnabled ? (
            <Badge tone="success">Enabled</Badge>
          ) : (
            <Badge tone="attention">Setup Required</Badge>
          )}
        </InlineStack>

        <Divider />

        {isEnabled ? (
          <BlockStack gap="300">
            <InlineStack gap="200" align="start">
              <Box>
                <Icon source={CheckIcon} tone="success" />
              </Box>
              <Text as="p">
                Schema extension is active on your theme. Google will see structured data for:
              </Text>
            </InlineStack>
            <Box paddingInlineStart="600">
              <List>
                <List.Item>Product pages (rich snippets with price, availability)</List.Item>
                <List.Item>Collection pages</List.Item>
                <List.Item>Blog articles</List.Item>
                <List.Item>Organization info on homepage</List.Item>
                <List.Item>Breadcrumb navigation</List.Item>
                <List.Item>FAQ content (when configured)</List.Item>
              </List>
            </Box>
            <Button url={appBlockUrl} target="_blank">
              Manage Extension Settings
            </Button>
          </BlockStack>
        ) : (
          <BlockStack gap="400">
            <Text as="p">
              Enable the LatentSEO Schema extension to automatically add structured data to your store.
              This helps Google understand your content and can enable rich results in search.
            </Text>

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Setup Instructions:
              </Text>
              <List type="number">
                <List.Item>
                  Click the button below to open your theme editor
                </List.Item>
                <List.Item>
                  In the theme editor, click "App embeds" in the left sidebar
                </List.Item>
                <List.Item>
                  Find "LatentSEO Schema" and toggle it ON
                </List.Item>
                <List.Item>
                  Configure schema settings (optional)
                </List.Item>
                <List.Item>
                  Click "Save" in the top right
                </List.Item>
              </List>
            </BlockStack>

            <InlineStack gap="200">
              <Button variant="primary" url={appBlockUrl} target="_blank">
                Open Theme Editor
                <Icon source={ExternalIcon} />
              </Button>
              <Button url="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" target="_blank">
                Learn about Structured Data
              </Button>
            </InlineStack>
          </BlockStack>
        )}

        <Divider />

        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">
            Validate Your Schema
          </Text>
          <Text as="p" tone="subdued">
            After enabling, verify your structured data is working correctly.
          </Text>

          <BlockStack gap="200">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              Step 1: Check your page source
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Visit any product page, right-click → "View Page Source", and search for "application/ld+json".
              You should see JSON-LD schema blocks.
            </Text>
          </BlockStack>

          <BlockStack gap="200">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              Step 2: Validate with Google
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              If your store is password-protected (common for development), use the Code Snippet option:
            </Text>
            <List type="number">
              <List.Item>Copy your entire page source (Ctrl+A from View Source)</List.Item>
              <List.Item>Go to Schema Markup Validator → click "Code Snippet" tab</List.Item>
              <List.Item>Paste and run the test</List.Item>
            </List>
          </BlockStack>

          <InlineStack gap="200">
            <Button
              url="https://validator.schema.org/"
              target="_blank"
            >
              Schema Markup Validator
            </Button>
            <Button
              url={`https://search.google.com/test/rich-results?url=${encodeURIComponent(`https://${shopDomain}`)}`}
              target="_blank"
              variant="plain"
            >
              Rich Results Test (live stores only)
            </Button>
          </InlineStack>

          <Banner tone="info">
            <Text as="p" variant="bodySm">
              The Rich Results Test requires your store to be publicly accessible.
              For password-protected or development stores, use the Schema Markup Validator with the Code Snippet option.
            </Text>
          </Banner>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

interface SchemaPreviewProps {
  pageType: "product" | "collection" | "article" | "index";
  data: Record<string, unknown>;
}

export function SchemaPreview({ pageType, data }: SchemaPreviewProps) {
  const schemaJson = JSON.stringify(data, null, 2);

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between">
          <Text as="h3" variant="headingSm">
            {pageType.charAt(0).toUpperCase() + pageType.slice(1)} Schema Preview
          </Text>
          <Badge>{data["@type"] as string}</Badge>
        </InlineStack>
        <Box
          padding="300"
          background="bg-surface-secondary"
          borderRadius="200"
        >
          <pre style={{
            margin: 0,
            fontSize: "12px",
            overflow: "auto",
            maxHeight: "200px",
            fontFamily: "monospace"
          }}>
            {schemaJson}
          </pre>
        </Box>
      </BlockStack>
    </Card>
  );
}
