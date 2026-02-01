import { useState, useCallback, useEffect } from "react";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams, useRevalidator } from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Thumbnail,
  Text,
  Badge,
  BlockStack,
  Box,
  Pagination,
  EmptyState,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getProductsWithSeo,
  updateProductSeo,
  getProductDetail,
} from "../services/products.server";
import { generateMetaDescription, generateMetaTitle } from "../services/gemini.server";
import { getOrCreateShop } from "../services/shop.server";
import { addSeoFixJob } from "../lib/queue.server";
import { SeoScoreIndicator } from "../components/seo/SeoScoreIndicator";
import { FilterBar } from "../components/seo/FilterBar";
import { BulkActionBar } from "../components/seo/BulkActionBar";
import { ProductDetailModal } from "../components/seo/ProductDetailModal";
import type { FilterOption, ProductSeoDisplay, SeoStatus } from "../types/seo";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const filter = (url.searchParams.get("filter") || "all") as FilterOption;
  const search = url.searchParams.get("search") || "";
  const after = url.searchParams.get("after") || null;

  const { products, pageInfo } = await getProductsWithSeo(admin, {
    first: 25,
    after,
    filter,
    searchQuery: search || undefined,
  });

  // Get shop settings for AI tone
  const shop = await getOrCreateShop(session.shop);

  return json({
    products,
    pageInfo,
    filter,
    search,
    shopDomain: session.shop,
    aiTone: shop.aiTone,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // Update SEO fields for a single product
  if (intent === "update-seo") {
    const productId = formData.get("productId") as string;
    const seoTitle = formData.get("seoTitle") as string;
    const seoDescription = formData.get("seoDescription") as string;

    const result = await updateProductSeo(admin, productId, {
      title: seoTitle,
      description: seoDescription,
    });

    return json({ intent: "update-seo", ...result });
  }

  // Generate AI content for a field
  if (intent === "generate-ai") {
    const productId = formData.get("productId") as string;
    const field = formData.get("field") as "title" | "description";

    const product = await getProductDetail(admin, productId);
    if (!product) {
      return json({ intent: "generate-ai", success: false, error: "Product not found", field });
    }

    const shop = await getOrCreateShop(session.shop);

    // Generate description using Gemini
    if (field === "description") {
      const description = await generateMetaDescription(
        {
          title: product.title,
          description: product.descriptionHtml,
          vendor: "",
          tags: [],
        },
        shop.aiTone
      );

      return json({
        intent: "generate-ai",
        success: true,
        field,
        content: description || ""
      });
    }

    // Generate title using Gemini
    if (field === "title") {
      const title = await generateMetaTitle(
        {
          title: product.title,
          description: product.descriptionHtml,
          vendor: "",
          tags: [],
        },
        shop.aiTone
      );

      return json({
        intent: "generate-ai",
        success: true,
        field,
        content: title || product.title.slice(0, 60)
      });
    }

    return json({ intent: "generate-ai", success: false, error: "Invalid field", field });
  }

  // Bulk action: start optimization job
  if (intent === "bulk-optimize") {
    const jobType = formData.get("jobType") as "META_DESCRIPTION" | "ALT_TEXT";
    const productIds = formData.getAll("productIds") as string[];

    const jobId = await addSeoFixJob({
      shopDomain: session.shop,
      jobType,
      productIds: productIds.length > 0 ? productIds : undefined,
    });

    return json({ intent: "bulk-optimize", success: true, jobId });
  }

  return json({ success: false, error: "Invalid intent" });
};

export default function ProductsPage() {
  const { products, pageInfo, filter, search } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const aiFetcher = useFetcher<typeof action>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();

  const [selectedProduct, setSelectedProduct] = useState<ProductSeoDisplay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingField, setGeneratingField] = useState<"title" | "description" | null>(null);
  const [generatedContent, setGeneratedContent] = useState<{
    field: "title" | "description";
    content: string;
  } | null>(null);
  const [lastHandledFetcherData, setLastHandledFetcherData] = useState<any>(null);

  // Index table selection
  const resourceName = {
    singular: "product",
    plural: "products",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(products as any);

  // Handle save response
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data !== lastHandledFetcherData) {
      const data = fetcher.data as any;
      if (data.intent === "update-seo") {
        setLastHandledFetcherData(fetcher.data);
        if (data.success) {
          shopify.toast.show("SEO updated successfully");
          // Close modal and refresh data
          setIsModalOpen(false);
          setSelectedProduct(null);
          revalidator.revalidate();
        } else {
          const errorMsg = data.errors?.join(", ") || "Failed to update SEO";
          shopify.toast.show(errorMsg, { isError: true });
          console.error("[Products] Save failed:", data.errors);
        }
      }
    }
  }, [fetcher.state, fetcher.data, shopify, revalidator, lastHandledFetcherData]);

  // Handle AI generation response
  useEffect(() => {
    if (aiFetcher.state === "idle" && aiFetcher.data) {
      const data = aiFetcher.data as any;
      if (data.intent === "generate-ai") {
        if (data.success && data.content) {
          setGeneratedContent({
            field: data.field,
            content: data.content,
          });
        }
        setGeneratingField(null);
      }
    }
  }, [aiFetcher.state, aiFetcher.data]);

  // Clear generated content when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      setGeneratedContent(null);
      setGeneratingField(null);
    }
  }, [isModalOpen]);

  // Filter handlers
  const handleFilterChange = useCallback(
    (newFilter: FilterOption) => {
      const params = new URLSearchParams(searchParams);
      if (newFilter === "all") {
        params.delete("filter");
      } else {
        params.set("filter", newFilter);
      }
      params.delete("after"); // Reset pagination
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams);
      if (query) {
        params.set("search", query);
      } else {
        params.delete("search");
      }
      params.delete("after"); // Reset pagination
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleSearchClear = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("search");
    params.delete("after");
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Pagination
  const handleNextPage = useCallback(() => {
    if (pageInfo.endCursor) {
      const params = new URLSearchParams(searchParams);
      params.set("after", pageInfo.endCursor);
      setSearchParams(params);
    }
  }, [pageInfo.endCursor, searchParams, setSearchParams]);

  const handlePreviousPage = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("after");
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Modal handlers
  const openProductModal = useCallback((product: ProductSeoDisplay) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
    setGeneratedContent(null);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setGeneratedContent(null);
    setGeneratingField(null);
  }, []);

  const handleSaveProduct = useCallback(
    (data: { productId: string; seoTitle: string; seoDescription: string }) => {
      fetcher.submit(
        {
          intent: "update-seo",
          productId: data.productId,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
        },
        { method: "POST" }
      );
      // Don't close modal here - wait for save to complete
    },
    [fetcher]
  );

  const handleRequestAIGenerate = useCallback(
    (productId: string, field: "title" | "description") => {
      setGeneratingField(field);
      setGeneratedContent(null);
      aiFetcher.submit(
        {
          intent: "generate-ai",
          productId,
          field,
        },
        { method: "POST" }
      );
    },
    [aiFetcher]
  );

  // Bulk actions
  const handleBulkGenerateMeta = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "bulk-optimize");
    formData.append("jobType", "META_DESCRIPTION");
    selectedResources.forEach((id) => formData.append("productIds", id));
    fetcher.submit(formData, { method: "POST" });
  }, [fetcher, selectedResources]);

  const handleClearSelection = useCallback(() => {
    handleSelectionChange("all" as any, false);
  }, [handleSelectionChange]);

  const isLoading = fetcher.state !== "idle";
  const isGenerating = aiFetcher.state !== "idle";

  // Table rows
  const rowMarkup = products.map((product, index) => (
    <IndexTable.Row
      id={product.id}
      key={product.id}
      selected={selectedResources.includes(product.id)}
      position={index}
      onClick={() => openProductModal(product as ProductSeoDisplay)}
    >
      <IndexTable.Cell>
        <Thumbnail
          source={product.featuredImage?.url || ""}
          alt={product.title}
          size="small"
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          {product.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <SeoScoreIndicator
          score={product.seoScore}
          status={product.seoStatus as SeoStatus}
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={product.hasTitle ? "success" : "critical"}>
          {product.hasTitle ? "Complete" : "Missing"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={product.hasMeta ? "success" : "critical"}>
          {product.hasMeta ? "Complete" : "Missing"}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page>
      <TitleBar title="Products" />
      <BlockStack gap="400">
        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedResources.length}
          onGenerateMeta={handleBulkGenerateMeta}
          onClearSelection={handleClearSelection}
          isLoading={isLoading}
        />

        <Card padding="0">
          <BlockStack gap="0">
            {/* Filter Bar */}
            <Box padding="400">
              <FilterBar
                selectedFilter={filter as FilterOption}
                onFilterChange={handleFilterChange}
                searchQuery={search}
                onSearchChange={handleSearchChange}
                onSearchClear={handleSearchClear}
              />
            </Box>

            {/* Products Table */}
            {products.length > 0 ? (
              <IndexTable
                resourceName={resourceName}
                itemCount={products.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "Image" },
                  { title: "Product" },
                  { title: "SEO Score" },
                  { title: "Title" },
                  { title: "Description" },
                ]}
                selectable
              >
                {rowMarkup}
              </IndexTable>
            ) : (
              <Box padding="600">
                <EmptyState heading="No products found" image="">
                  <Text as="p" tone="subdued">
                    {filter !== "all"
                      ? "Try adjusting your filters to find what you're looking for."
                      : "Add products to your store to start optimizing SEO."}
                  </Text>
                </EmptyState>
              </Box>
            )}

            {/* Pagination */}
            {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
              <Box padding="400" borderBlockStartWidth="025" borderColor="border">
                <Pagination
                  hasPrevious={pageInfo.hasPreviousPage}
                  hasNext={pageInfo.hasNextPage}
                  onPrevious={handlePreviousPage}
                  onNext={handleNextPage}
                />
              </Box>
            )}
          </BlockStack>
        </Card>

        {/* Product Detail Modal */}
        <ProductDetailModal
          product={selectedProduct}
          open={isModalOpen}
          onClose={closeModal}
          onSave={handleSaveProduct}
          onRequestAIGenerate={handleRequestAIGenerate}
          generatedContent={generatedContent}
          isSaving={isLoading}
          isGenerating={isGenerating}
          generatingField={generatingField}
        />
      </BlockStack>
    </Page>
  );
}
