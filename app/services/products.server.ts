import type {
  ProductWithSeo,
  ProductSeoDisplay,
  ProductCounts,
  PageInfo,
  FilterOption,
  SeoStatus,
} from "../types/seo";

// Type for the admin GraphQL client from authenticate.admin()
type AdminGraphQL = {
  graphql: (query: string, options?: { variables?: Record<string, any> }) => Promise<Response>;
};

// GraphQL query to fetch products with SEO data
const PRODUCTS_WITH_SEO_QUERY = `#graphql
  query GetProductsWithSEO($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          title
          handle
          status
          featuredImage {
            url
            altText
          }
          images(first: 5) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
          descriptionHtml
          seo {
            title
            description
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

// GraphQL query to get a single product
const PRODUCT_DETAIL_QUERY = `#graphql
  query GetProductDetail($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      descriptionHtml
      featuredImage {
        url
        altText
      }
      images(first: 20) {
        edges {
          node {
            id
            url
            altText
          }
        }
      }
      seo {
        title
        description
      }
    }
  }
`;

// GraphQL mutation to update product SEO
const UPDATE_PRODUCT_SEO_MUTATION = `#graphql
  mutation UpdateProductSEO($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Calculate SEO score for a product
export function calculateSeoScore(product: ProductWithSeo): {
  score: number;
  status: SeoStatus;
  hasTitle: boolean;
  hasMeta: boolean;
} {
  let score = 0;

  // Meta title: 40 points (trim whitespace before checking)
  const hasSeoTitle = !!product.seo.title && product.seo.title.trim().length > 0;
  if (hasSeoTitle) score += 40;

  // Meta description: 60 points (trim whitespace before checking)
  const hasSeoDescription = !!product.seo.description && product.seo.description.trim().length > 0;
  if (hasSeoDescription) score += 60;

  // Determine status
  let status: SeoStatus;
  if (score < 50) {
    status = "critical" as SeoStatus;
  } else if (score < 80) {
    status = "warning" as SeoStatus;
  } else {
    status = "success" as SeoStatus;
  }

  return {
    score,
    status,
    hasTitle: hasSeoTitle,
    hasMeta: hasSeoDescription,
  };
}

// Build query string based on filter
// Note: Shopify's search API doesn't reliably support querying for empty SEO fields
// So we do client-side filtering for SEO-related filters
function buildFilterQuery(filter: FilterOption): string | null {
  switch (filter) {
    case "missing_title":
    case "missing_meta":
    case "optimized":
      // These require client-side filtering after fetching
      return null;
    case "all":
    default:
      return null;
  }
}

// Fetch products with SEO data
export async function getProductsWithSeo(
  admin: AdminGraphQL,
  options: {
    first?: number;
    after?: string | null;
    filter?: FilterOption;
    searchQuery?: string;
  } = {}
): Promise<{
  products: ProductSeoDisplay[];
  pageInfo: PageInfo;
}> {
  const { first = 25, after = null, filter = "all", searchQuery } = options;

  // Build the query
  let query = buildFilterQuery(filter);
  if (searchQuery) {
    query = query ? `${query} AND title:*${searchQuery}*` : `title:*${searchQuery}*`;
  }

  const response = await admin.graphql(PRODUCTS_WITH_SEO_QUERY, {
    variables: {
      first,
      after,
      query,
    },
  });

  const data = await response.json();
  const productsData = data.data?.products;

  if (!productsData) {
    return { products: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } };
  }

  // Transform products
  let products: ProductSeoDisplay[] = productsData.edges.map((edge: any) => {
    const node = edge.node;
    const product: ProductWithSeo = {
      id: node.id,
      title: node.title,
      handle: node.handle,
      status: node.status,
      descriptionHtml: node.descriptionHtml || "",
      featuredImage: node.featuredImage,
      images: node.images.edges.map((e: any) => e.node),
      seo: {
        title: node.seo?.title || null,
        description: node.seo?.description || null,
      },
    };

    const seoData = calculateSeoScore(product);

    return {
      ...product,
      seoScore: seoData.score,
      seoStatus: seoData.status,
      hasTitle: seoData.hasTitle,
      hasMeta: seoData.hasMeta,
    };
  });

  // Client-side filtering (Shopify doesn't support SEO field queries)
  if (filter === "missing_title") {
    products = products.filter((p) => !p.hasTitle);
  } else if (filter === "missing_meta") {
    products = products.filter((p) => !p.hasMeta);
  } else if (filter === "optimized") {
    products = products.filter((p) => p.hasMeta && p.hasTitle);
  }

  return {
    products,
    pageInfo: productsData.pageInfo,
  };
}

// Fetch single product detail
export async function getProductDetail(
  admin: AdminGraphQL,
  productId: string
): Promise<ProductSeoDisplay | null> {
  const response = await admin.graphql(PRODUCT_DETAIL_QUERY, {
    variables: { id: productId },
  });

  const data = await response.json();
  const node = data.data?.product;

  if (!node) return null;

  const product: ProductWithSeo = {
    id: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    descriptionHtml: node.descriptionHtml || "",
    featuredImage: node.featuredImage,
    images: node.images.edges.map((e: any) => e.node),
    seo: {
      title: node.seo?.title || null,
      description: node.seo?.description || null,
    },
  };

  const seoData = calculateSeoScore(product);

  return {
    ...product,
    seoScore: seoData.score,
    seoStatus: seoData.status,
    hasTitle: seoData.hasTitle,
    hasMeta: seoData.hasMeta,
  };
}

// Update product SEO fields
export async function updateProductSeo(
  admin: AdminGraphQL,
  productId: string,
  seo: { title?: string; description?: string }
): Promise<{ success: boolean; errors: string[] }> {
  console.log("[Products] Updating SEO for product:", productId, seo);

  try {
    const response = await admin.graphql(UPDATE_PRODUCT_SEO_MUTATION, {
      variables: {
        input: {
          id: productId,
          seo,
        },
      },
    });

    const data = await response.json();
    console.log("[Products] GraphQL response:", JSON.stringify(data, null, 2));

    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      const errorMessages = data.errors.map((e: any) => e.message);
      console.error("[Products] GraphQL errors:", errorMessages);
      return { success: false, errors: errorMessages };
    }

    const result = data.data?.productUpdate;

    if (!result) {
      console.error("[Products] No productUpdate in response");
      return { success: false, errors: ["Failed to update product - no response"] };
    }

    if (result.userErrors?.length > 0) {
      const errorMessages = result.userErrors.map((e: any) => e.message);
      console.error("[Products] User errors:", errorMessages);
      return {
        success: false,
        errors: errorMessages,
      };
    }

    console.log("[Products] Successfully updated product SEO");
    return { success: true, errors: [] };
  } catch (error) {
    console.error("[Products] Exception updating SEO:", error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

// Get product counts for dashboard
export async function getProductCounts(
  admin: AdminGraphQL
): Promise<ProductCounts> {
  // Note: Shopify's productsCount query has limitations
  // We'll use a simpler approach with products query
  const countQuery = `#graphql
    query ProductCounts {
      total: productsCount {
        count
      }
      # Note: These filtered counts may not work as expected in all Shopify API versions
      # We use a simplified approach
    }
  `;

  try {
    const response = await admin.graphql(countQuery);
    const data = await response.json();

    const total = data.data?.total?.count || 0;

    // For more accurate counts, we'd need to fetch products and count client-side
    // For now, we'll estimate based on a sample
    const sampleResponse = await admin.graphql(PRODUCTS_WITH_SEO_QUERY, {
      variables: { first: 50, after: null, query: null },
    });
    const sampleData = await sampleResponse.json();
    const sampleProducts = sampleData.data?.products?.edges || [];

    let missingTitle = 0;
    let missingMeta = 0;
    let optimized = 0;

    sampleProducts.forEach((edge: any) => {
      const node = edge.node;
      const hasTitle = node.seo?.title && node.seo.title.trim() !== "";
      const hasDescription = node.seo?.description && node.seo.description.trim() !== "";

      if (!hasTitle) missingTitle++;
      if (!hasDescription) missingMeta++;
      if (hasTitle && hasDescription) optimized++;
    });

    // Scale to total if we have more products
    const sampleSize = sampleProducts.length;
    if (sampleSize > 0 && total > sampleSize) {
      const scale = total / sampleSize;
      missingTitle = Math.round(missingTitle * scale);
      missingMeta = Math.round(missingMeta * scale);
      optimized = Math.round(optimized * scale);
    }

    return {
      total,
      missingTitle,
      missingMeta,
      optimized,
    };
  } catch (error) {
    console.error("[Products] Failed to get counts:", error);
    return {
      total: 0,
      missingTitle: 0,
      missingMeta: 0,
      optimized: 0,
    };
  }
}
