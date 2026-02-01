/**
 * Test utilities for integration tests
 */
import { vi } from "vitest";

// Mock Shopify session data
export const mockSession = {
  id: "test-session-id",
  shop: "test-shop.myshopify.com",
  state: "active",
  isOnline: false,
  scope: "read_products,write_products",
  accessToken: "test-access-token",
  expires: null,
};

// Mock Shopify admin object
export const createMockAdmin = () => ({
  graphql: vi.fn(),
  rest: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
});

// Mock authenticate.admin function
export const createMockAuthenticate = (session = mockSession, admin = createMockAdmin()) => ({
  admin: vi.fn().mockResolvedValue({ session, admin }),
});

// Create a mock request
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): Request {
  const { method = "GET", body, headers = {} } = options;

  const requestInit: RequestInit = {
    method,
    headers: new Headers({
      ...headers,
    }),
  };

  if (body && method !== "GET") {
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      formData.append(key, value);
    });
    requestInit.body = formData;
  }

  return new Request(url, requestInit);
}

// Mock product data
export const mockProducts = [
  {
    id: "gid://shopify/Product/1",
    title: "Test Product 1",
    handle: "test-product-1",
    descriptionHtml: "<p>Test description 1</p>",
    seo: {
      title: "Test SEO Title 1",
      description: "Test meta description 1",
    },
    images: {
      edges: [
        {
          node: {
            id: "gid://shopify/ProductImage/1",
            url: "https://cdn.shopify.com/test1.jpg",
            altText: "Test alt text 1",
          },
        },
      ],
    },
  },
  {
    id: "gid://shopify/Product/2",
    title: "Test Product 2",
    handle: "test-product-2",
    descriptionHtml: "<p>Test description 2</p>",
    seo: {
      title: null,
      description: null,
    },
    images: {
      edges: [
        {
          node: {
            id: "gid://shopify/ProductImage/2",
            url: "https://cdn.shopify.com/test2.jpg",
            altText: null,
          },
        },
      ],
    },
  },
];

// Mock GraphQL response for products
export const mockProductsGraphQLResponse = {
  data: {
    products: {
      edges: mockProducts.map((product) => ({ node: product })),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
    },
  },
};

// Mock shop data
export const mockShop = {
  shopDomain: "test-shop.myshopify.com",
  plan: "FREE",
  aiTone: "PROFESSIONAL",
  autoPublish: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock job data
export const mockJob = {
  id: "job-123",
  shopDomain: "test-shop.myshopify.com",
  type: "META_DESCRIPTION",
  status: "COMPLETED",
  totalItems: 10,
  processedItems: 10,
  failedItems: 0,
  createdAt: new Date(),
  completedAt: new Date(),
};

// Mock optimization log data
export const mockOptimizationLogs = [
  {
    id: "log-1",
    shopDomain: "test-shop.myshopify.com",
    jobId: "job-123",
    productId: "gid://shopify/Product/1",
    productTitle: "Test Product 1",
    field: "meta_description",
    oldValue: "",
    newValue: "Generated meta description",
    isReverted: false,
    revertedAt: null,
    createdAt: new Date(),
  },
  {
    id: "log-2",
    shopDomain: "test-shop.myshopify.com",
    jobId: "job-123",
    productId: "gid://shopify/Product/2",
    productTitle: "Test Product 2",
    field: "meta_title",
    oldValue: "",
    newValue: "Generated meta title",
    isReverted: false,
    revertedAt: null,
    createdAt: new Date(),
  },
];

// Mock analytics data
export const mockAnalytics = {
  totalOptimizations: 100,
  totalProductsOptimized: 50,
  totalJobs: 10,
  thisMonthOptimizations: 25,
  thisMonthProducts: 15,
  thisMonthJobs: 3,
  metaTitlesGenerated: 30,
  metaDescriptionsGenerated: 50,
  altTextsGenerated: 20,
  seoHealthScore: 75,
  dailyTrends: [
    { date: "2026-01-25", optimizations: 5, products: 3 },
    { date: "2026-01-26", optimizations: 8, products: 4 },
    { date: "2026-01-27", optimizations: 12, products: 6 },
  ],
  recentActivity: [],
};
