import { describe, it, expect, vi, beforeEach } from "vitest";
import { json } from "@remix-run/node";

// Hoisted mocks
const { mockPrisma, mockAuthenticate, mockAuditProducts } = vi.hoisted(() => {
  return {
    mockPrisma: {
      shop: { findUnique: vi.fn() },
      job: { findMany: vi.fn(), count: vi.fn() },
      optimizationLog: { findMany: vi.fn(), count: vi.fn() },
    },
    mockAuthenticate: {
      admin: vi.fn(),
    },
    mockAuditProducts: vi.fn(),
  };
});

// Mock dependencies
vi.mock("../../app/db.server", () => ({ prisma: mockPrisma }));
vi.mock("../../app/shopify.server", () => ({ authenticate: mockAuthenticate }));
vi.mock("../../app/services/seo-audit.server", () => ({
  auditProducts: mockAuditProducts,
  auditProduct: vi.fn(),
  getScoreLabel: vi.fn((score: number) => {
    if (score >= 80) return { label: "Good", tone: "success" };
    if (score >= 50) return { label: "Needs Work", tone: "warning" };
    return { label: "Critical", tone: "critical" };
  }),
}));

import {
  mockSession,
  mockProducts,
  mockProductsGraphQLResponse,
} from "./test-utils";

describe("SEO Audit Route Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should fetch products and return audit results", async () => {
      const mockAdmin = {
        graphql: vi.fn().mockResolvedValue({
          json: () => Promise.resolve(mockProductsGraphQLResponse),
        }),
      };

      mockAuthenticate.admin.mockResolvedValue({
        admin: mockAdmin,
        session: mockSession,
      });

      mockAuditProducts.mockReturnValue({
        results: [
          {
            productId: "gid://shopify/Product/1",
            productTitle: "Test Product 1",
            score: 100,
            issues: [],
          },
          {
            productId: "gid://shopify/Product/2",
            productTitle: "Test Product 2",
            score: 30,
            issues: [
              { field: "metaTitle", severity: "critical", message: "Missing SEO title" },
              { field: "metaDescription", severity: "critical", message: "Missing meta description" },
            ],
          },
        ],
        stats: {
          totalProducts: 2,
          avgScore: 65,
          criticalCount: 1,
          warningCount: 0,
          optimizedCount: 1,
        },
      });

      // Import and call loader
      const { loader } = await import("../../app/routes/app.audit");
      const request = new Request("http://localhost/app/audit");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.results).toHaveLength(2);
      expect(data.stats.totalProducts).toBe(2);
      expect(data.stats.avgScore).toBe(65);
      expect(data.stats.criticalCount).toBe(1);
      expect(mockAdmin.graphql).toHaveBeenCalled();
      expect(mockAuditProducts).toHaveBeenCalled();
    });

    it("should handle empty product list", async () => {
      const mockAdmin = {
        graphql: vi.fn().mockResolvedValue({
          json: () =>
            Promise.resolve({
              data: {
                products: {
                  edges: [],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            }),
        }),
      };

      mockAuthenticate.admin.mockResolvedValue({
        admin: mockAdmin,
        session: mockSession,
      });

      mockAuditProducts.mockReturnValue({
        results: [],
        stats: {
          totalProducts: 0,
          avgScore: 0,
          criticalCount: 0,
          warningCount: 0,
          optimizedCount: 0,
        },
      });

      const { loader } = await import("../../app/routes/app.audit");
      const request = new Request("http://localhost/app/audit");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.results).toHaveLength(0);
      expect(data.stats.totalProducts).toBe(0);
    });
  });
});
