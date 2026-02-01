import { useState, useCallback, useEffect } from "react";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  Select,
  Checkbox,
  Button,
  BlockStack,
  Text,
  Banner,
  Box,
  TextField,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrCreateShop, updateShopSettings } from "../services/shop.server";
import { ExtensionSetup } from "../components/ExtensionSetup";
import { useSaveShortcut } from "../hooks/useKeyboardShortcuts";

const TONE_OPTIONS = [
  {
    label: "Professional",
    value: "PROFESSIONAL",
    description: "Clear, authoritative, and trustworthy tone",
  },
  {
    label: "Fun & Playful",
    value: "FUN",
    description: "Energetic and engaging while remaining informative",
  },
  {
    label: "Urgent",
    value: "URGENT",
    description: "Action-driven with FOMO elements",
  },
  {
    label: "Luxury",
    value: "LUXURY",
    description: "Sophisticated and premium, emphasizing exclusivity",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const shop = await getOrCreateShop(session.shop);

  // Get the main theme ID for extension setup
  let mainThemeId: string | null = null;
  try {
    const response = await admin.graphql(`
      query {
        themes(first: 10, roles: [MAIN]) {
          edges {
            node {
              id
              name
              role
            }
          }
        }
      }
    `);
    const data = await response.json();
    const mainTheme = data?.data?.themes?.edges?.[0]?.node;
    if (mainTheme?.id) {
      // Extract numeric ID from GID
      mainThemeId = mainTheme.id.replace("gid://shopify/OnlineStoreTheme/", "");
    }
  } catch (error) {
    console.error("[Settings] Failed to fetch theme:", error);
  }

  return json({
    shopDomain: session.shop,
    aiTone: shop.aiTone,
    autoPublish: shop.autoPublish,
    plan: shop.plan,
    customMetaTitlePrompt: shop.customMetaTitlePrompt || "",
    customMetaDescriptionPrompt: shop.customMetaDescriptionPrompt || "",
    customAltTextPrompt: shop.customAltTextPrompt || "",
    mainThemeId,
    // Phase 6: Additional settings
    notifyOnJobComplete: shop.notifyOnJobComplete,
    notificationEmail: shop.notificationEmail || "",
    customGeminiApiKey: shop.customGeminiApiKey ? "••••••••" : "",
    hasCustomApiKey: !!shop.customGeminiApiKey,
    excludedTags: shop.excludedTags || [],
    excludedCollections: shop.excludedCollections || [],
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const aiTone = formData.get("aiTone") as string;
  const autoPublish = formData.get("autoPublish") === "true";
  const customMetaTitlePrompt = (formData.get("customMetaTitlePrompt") as string) || null;
  const customMetaDescriptionPrompt = (formData.get("customMetaDescriptionPrompt") as string) || null;
  const customAltTextPrompt = (formData.get("customAltTextPrompt") as string) || null;

  // Phase 6: Additional settings
  const notifyOnJobComplete = formData.get("notifyOnJobComplete") === "true";
  const notificationEmail = (formData.get("notificationEmail") as string) || null;
  const customGeminiApiKey = formData.get("customGeminiApiKey") as string;
  const excludedTagsStr = formData.get("excludedTags") as string;
  const excludedCollectionsStr = formData.get("excludedCollections") as string;

  // Parse comma-separated tags and collections
  const excludedTags = excludedTagsStr
    ? excludedTagsStr.split(",").map(t => t.trim()).filter(Boolean)
    : [];
  const excludedCollections = excludedCollectionsStr
    ? excludedCollectionsStr.split(",").map(c => c.trim()).filter(Boolean)
    : [];

  try {
    const updateData: Parameters<typeof updateShopSettings>[1] = {
      aiTone,
      autoPublish,
      customMetaTitlePrompt: customMetaTitlePrompt?.trim() || null,
      customMetaDescriptionPrompt: customMetaDescriptionPrompt?.trim() || null,
      customAltTextPrompt: customAltTextPrompt?.trim() || null,
      notifyOnJobComplete,
      notificationEmail: notificationEmail?.trim() || null,
      excludedTags,
      excludedCollections,
    };

    // Only update API key if a new one was provided (not masked)
    if (customGeminiApiKey && !customGeminiApiKey.includes("••••")) {
      updateData.customGeminiApiKey = customGeminiApiKey.trim() || null;
    }

    await updateShopSettings(session.shop, updateData);

    return json({ success: true });
  } catch (error) {
    console.error("[Settings] Failed to save:", error);
    return json(
      { success: false, error: "Failed to save settings" },
      { status: 500 }
    );
  }
};

export default function SettingsPage() {
  const {
    aiTone,
    autoPublish,
    plan,
    shopDomain,
    customMetaTitlePrompt,
    customMetaDescriptionPrompt,
    customAltTextPrompt,
    mainThemeId,
    // Phase 6
    notifyOnJobComplete: initialNotify,
    notificationEmail: initialNotifyEmail,
    hasCustomApiKey,
    excludedTags: initialExcludedTags,
    excludedCollections: initialExcludedCollections,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [tone, setTone] = useState(aiTone);
  const [publish, setPublish] = useState(autoPublish);
  const [metaTitlePrompt, setMetaTitlePrompt] = useState(customMetaTitlePrompt);
  const [metaDescPrompt, setMetaDescPrompt] = useState(customMetaDescriptionPrompt);
  const [altTextPrompt, setAltTextPrompt] = useState(customAltTextPrompt);
  const [hasChanges, setHasChanges] = useState(false);

  // Phase 6: Additional state
  const [notifyOnComplete, setNotifyOnComplete] = useState(initialNotify);
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [apiKey, setApiKey] = useState(hasCustomApiKey ? "••••••••" : "");
  const [excludedTags, setExcludedTags] = useState(initialExcludedTags.join(", "));
  const [excludedCollections, setExcludedCollections] = useState(initialExcludedCollections.join(", "));

  const handleToneChange = useCallback((value: string) => {
    setTone(value);
    setHasChanges(true);
  }, []);

  const handlePublishChange = useCallback((value: boolean) => {
    setPublish(value);
    setHasChanges(true);
  }, []);

  const handleMetaTitlePromptChange = useCallback((value: string) => {
    setMetaTitlePrompt(value);
    setHasChanges(true);
  }, []);

  const handleMetaDescPromptChange = useCallback((value: string) => {
    setMetaDescPrompt(value);
    setHasChanges(true);
  }, []);

  const handleAltTextPromptChange = useCallback((value: string) => {
    setAltTextPrompt(value);
    setHasChanges(true);
  }, []);

  // Phase 6: Additional handlers
  const handleNotifyChange = useCallback((value: boolean) => {
    setNotifyOnComplete(value);
    setHasChanges(true);
  }, []);

  const handleNotifyEmailChange = useCallback((value: string) => {
    setNotifyEmail(value);
    setHasChanges(true);
  }, []);

  const handleApiKeyChange = useCallback((value: string) => {
    setApiKey(value);
    setHasChanges(true);
  }, []);

  const handleExcludedTagsChange = useCallback((value: string) => {
    setExcludedTags(value);
    setHasChanges(true);
  }, []);

  const handleExcludedCollectionsChange = useCallback((value: string) => {
    setExcludedCollections(value);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    fetcher.submit(
      {
        aiTone: tone,
        autoPublish: String(publish),
        customMetaTitlePrompt: metaTitlePrompt,
        customMetaDescriptionPrompt: metaDescPrompt,
        customAltTextPrompt: altTextPrompt,
        // Phase 6
        notifyOnJobComplete: String(notifyOnComplete),
        notificationEmail: notifyEmail,
        customGeminiApiKey: apiKey,
        excludedTags: excludedTags,
        excludedCollections: excludedCollections,
      },
      { method: "POST" }
    );
    setHasChanges(false);
  }, [fetcher, tone, publish, metaTitlePrompt, metaDescPrompt, altTextPrompt, notifyOnComplete, notifyEmail, apiKey, excludedTags, excludedCollections]);

  // Show toast on save result
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        shopify.toast.show("Settings saved");
      } else if (fetcher.data.error) {
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const isLoading = fetcher.state !== "idle";
  const selectedToneOption = TONE_OPTIONS.find((o) => o.value === tone);

  // Keyboard shortcut for save (Ctrl+S)
  useSaveShortcut(handleSave, hasChanges && !isLoading);

  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        {/* AI Settings */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              AI Generation Settings
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Configure how AI generates SEO content for your products.
            </Text>

            <FormLayout>
              <Select
                label="AI Tone"
                options={TONE_OPTIONS.map((o) => ({
                  label: o.label,
                  value: o.value,
                }))}
                value={tone}
                onChange={handleToneChange}
                helpText={selectedToneOption?.description}
              />

              <Checkbox
                label="Auto-publish optimizations"
                checked={publish}
                onChange={handlePublishChange}
                helpText="Automatically apply AI-generated content without review. When disabled, changes will require manual approval."
              />
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Custom Prompts */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Custom AI Instructions
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Override default AI prompts with your own instructions. Leave blank to use defaults.
            </Text>

            <FormLayout>
              <TextField
                label="Meta Title Instructions"
                value={metaTitlePrompt}
                onChange={handleMetaTitlePromptChange}
                multiline={3}
                placeholder="e.g., Always include brand name at the end. Focus on key product benefits."
                helpText="Custom instructions for generating SEO titles (50-60 chars)"
                maxLength={500}
                showCharacterCount
              />

              <TextField
                label="Meta Description Instructions"
                value={metaDescPrompt}
                onChange={handleMetaDescPromptChange}
                multiline={3}
                placeholder="e.g., Emphasize free shipping. Include a call-to-action. Mention eco-friendly materials."
                helpText="Custom instructions for generating meta descriptions (130-160 chars)"
                maxLength={500}
                showCharacterCount
              />

              <TextField
                label="Alt Text Instructions"
                value={altTextPrompt}
                onChange={handleAltTextPromptChange}
                multiline={3}
                placeholder="e.g., Focus on product color and material. Include size context when visible."
                helpText="Custom instructions for generating image alt text (max 125 chars)"
                maxLength={500}
                showCharacterCount
              />
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Notification Preferences
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Configure how you receive updates about optimization jobs.
            </Text>

            <FormLayout>
              <Checkbox
                label="Notify when jobs complete"
                checked={notifyOnComplete}
                onChange={handleNotifyChange}
                helpText="Receive a notification when bulk optimization jobs finish."
              />

              <TextField
                label="Notification Email"
                type="email"
                value={notifyEmail}
                onChange={handleNotifyEmailChange}
                placeholder="Leave blank to use store email"
                helpText="Override the email address for job notifications."
                autoComplete="email"
              />
            </FormLayout>
          </BlockStack>
        </Card>

        {/* API Key Management */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              API Key Management
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Use your own Gemini API key for AI generation. Leave blank to use the default shared key.
            </Text>

            <FormLayout>
              <TextField
                label="Custom Gemini API Key"
                type="password"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Enter your Gemini API key"
                helpText={hasCustomApiKey ? "A custom API key is configured. Enter a new key to replace it." : "Get your API key from Google AI Studio."}
                autoComplete="off"
              />
            </FormLayout>

            {hasCustomApiKey && (
              <Banner tone="success">
                Using your custom Gemini API key.
              </Banner>
            )}
          </BlockStack>
        </Card>

        {/* Exclusion Rules */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Exclusion Rules
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Skip certain products during bulk optimization jobs.
            </Text>

            <FormLayout>
              <TextField
                label="Excluded Tags"
                value={excludedTags}
                onChange={handleExcludedTagsChange}
                placeholder="e.g., no-seo, draft, hidden"
                helpText="Comma-separated list of product tags to skip. Products with any of these tags will not be optimized."
              />

              <TextField
                label="Excluded Collections"
                value={excludedCollections}
                onChange={handleExcludedCollectionsChange}
                placeholder="e.g., archive, test-products, internal"
                helpText="Comma-separated list of collection handles to skip. Products in these collections will not be optimized."
              />
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Schema Extension Setup */}
        <ExtensionSetup
          shopDomain={shopDomain}
          themeId={mainThemeId || undefined}
        />

        {/* Plan Info */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Current Plan
            </Text>

            <Box
              padding="400"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="200">
                <Text as="p" variant="headingLg">
                  {plan === "PRO" ? "Pro Plan" : "Free Plan"}
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {plan === "PRO"
                    ? "Unlimited optimizations with priority processing."
                    : "Up to 50 products per month. Upgrade for unlimited access."}
                </Text>
              </BlockStack>
            </Box>

            {plan !== "PRO" && (
              <Banner
                title="Upgrade to Pro"
                tone="info"
                action={{ content: "View plans", url: "/app/billing" }}
              >
                Get unlimited optimizations, priority processing, and advanced features.
              </Banner>
            )}
          </BlockStack>
        </Card>

        {/* Account Info */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Account
            </Text>

            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                <Text as="span" fontWeight="semibold">
                  Shop:{" "}
                </Text>
                {shopDomain}
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Save Button */}
        <Box>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isLoading}
            disabled={!hasChanges || isLoading}
          >
            Save Settings
          </Button>
        </Box>
      </BlockStack>
    </Page>
  );
}
