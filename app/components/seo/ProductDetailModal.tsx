import { useState, useCallback, useEffect } from "react";
import {
  Modal,
  TextField,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Thumbnail,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import type { ProductSeoDisplay } from "../../types/seo";

interface ProductDetailModalProps {
  product: ProductSeoDisplay | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    productId: string;
    seoTitle: string;
    seoDescription: string;
  }) => void;
  onRequestAIGenerate: (productId: string, field: "title" | "description") => void;
  generatedContent: { field: "title" | "description"; content: string } | null;
  isSaving?: boolean;
  isGenerating?: boolean;
  generatingField?: "title" | "description" | null;
}

const TITLE_MAX_LENGTH = 60;
const DESCRIPTION_MAX_LENGTH = 160;

export function ProductDetailModal({
  product,
  open,
  onClose,
  onSave,
  onRequestAIGenerate,
  generatedContent,
  isSaving = false,
  isGenerating = false,
  generatingField = null,
}: ProductDetailModalProps) {
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      setSeoTitle(product.seo.title || "");
      setSeoDescription(product.seo.description || "");
    }
  }, [product]);

  // Update fields when AI generates content
  useEffect(() => {
    if (generatedContent) {
      if (generatedContent.field === "title" && generatedContent.content) {
        setSeoTitle(generatedContent.content);
      } else if (generatedContent.field === "description" && generatedContent.content) {
        setSeoDescription(generatedContent.content);
      }
    }
  }, [generatedContent]);

  const handleGenerateAI = useCallback(
    (field: "title" | "description") => {
      if (product) {
        onRequestAIGenerate(product.id, field);
      }
    },
    [product, onRequestAIGenerate]
  );

  const handleSave = useCallback(() => {
    if (!product) return;
    onSave({
      productId: product.id,
      seoTitle,
      seoDescription,
    });
  }, [product, seoTitle, seoDescription, onSave]);

  if (!product) return null;

  const titleLength = seoTitle.length;
  const descriptionLength = seoDescription.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product.title}
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving,
        disabled: isSaving || isGenerating,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
          disabled: isSaving,
        },
      ]}
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="500">
          {/* Product Preview */}
          <InlineStack gap="400" blockAlign="start">
            {product.featuredImage && (
              <Thumbnail
                source={product.featuredImage.url}
                alt={product.featuredImage.altText || product.title}
                size="large"
              />
            )}
            <BlockStack gap="100">
              <Text as="h3" variant="headingMd">
                {product.title}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Handle: {product.handle}
              </Text>
            </BlockStack>
          </InlineStack>

          <Divider />

          {/* SEO Title */}
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h4" variant="headingSm">
                SEO Title
              </Text>
              <Button
                variant="plain"
                onClick={() => handleGenerateAI("title")}
                loading={generatingField === "title"}
                disabled={isGenerating}
              >
                Generate with AI
              </Button>
            </InlineStack>
            <TextField
              label="SEO Title"
              labelHidden
              value={seoTitle}
              onChange={setSeoTitle}
              maxLength={TITLE_MAX_LENGTH + 10}
              showCharacterCount
              autoComplete="off"
              helpText={`Recommended: under ${TITLE_MAX_LENGTH} characters`}
              error={
                titleLength > TITLE_MAX_LENGTH
                  ? `Title is ${titleLength - TITLE_MAX_LENGTH} characters over the recommended length`
                  : undefined
              }
            />
            {titleLength === 0 && (
              <Banner tone="info">
                SEO title is optional. Shopify uses your product title if not set.
              </Banner>
            )}
          </BlockStack>

          {/* SEO Description */}
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h4" variant="headingSm">
                SEO Description
              </Text>
              <Button
                variant="plain"
                onClick={() => handleGenerateAI("description")}
                loading={generatingField === "description"}
                disabled={isGenerating}
              >
                Generate with AI
              </Button>
            </InlineStack>
            <TextField
              label="SEO Description"
              labelHidden
              value={seoDescription}
              onChange={setSeoDescription}
              maxLength={DESCRIPTION_MAX_LENGTH + 20}
              showCharacterCount
              multiline={3}
              autoComplete="off"
              helpText={`Recommended: 130-${DESCRIPTION_MAX_LENGTH} characters`}
              error={
                descriptionLength > DESCRIPTION_MAX_LENGTH
                  ? `Description is ${descriptionLength - DESCRIPTION_MAX_LENGTH} characters over the recommended length`
                  : undefined
              }
            />
            {descriptionLength === 0 && (
              <Banner tone="critical">
                SEO description is empty. Add a description to improve click-through rates.
              </Banner>
            )}
          </BlockStack>

          {/* Image Alt Text Section */}
          {product.images.length > 0 && (
            <>
              <Divider />
              <BlockStack gap="300">
                <Text as="h4" variant="headingSm">
                  Image Alt Text
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Alt text helps with accessibility and image SEO. Edit alt text directly in the Shopify admin.
                </Text>
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <InlineStack gap="300" wrap>
                    {product.images.slice(0, 5).map((image) => (
                      <BlockStack key={image.id} gap="100" inlineAlign="center">
                        <Thumbnail
                          source={image.url}
                          alt={image.altText || "No alt text"}
                          size="medium"
                        />
                        <Text
                          as="span"
                          variant="bodySm"
                          tone={image.altText ? "subdued" : "critical"}
                        >
                          {image.altText ? "Has alt" : "Missing"}
                        </Text>
                      </BlockStack>
                    ))}
                  </InlineStack>
                </Box>
              </BlockStack>
            </>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
