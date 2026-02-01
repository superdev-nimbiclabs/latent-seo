import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockPrisma, mockAuthenticate, mockGetDashboardAnalytics, mockGetMonthlyTrends, mockGetOptimizationBreakdown, mockAuditProducts } = vi.hoisted(() => {
  return {
    mockPrisma: {
      shop: { findUnique: vi.fn() },
      optimizationLog: { findMany: vi.fn() },
    },
    mockAuthenticate: {
      admin: vi.fn(),
    },
    mockGetDashboardAnalytics: vi.fn(),
    mockGetMonthlyTrends: vi.fn(),
    mockGetOptimizationBreakdown: vi.fn(),
    mockAuditProducts: vi.fn(),
  };
});

// Mock dependencies
vi.mock("../../app/db.server", () => ({ prisma: mockPrisma }));
vi.mock("../../app/shopify.server", () => ({ authenticate: mockAuthenticate }));
vi.mock("../../app/services/analytics.server", () => ({
  getDashboardAnalytics: mockGetDashboardAnalytics,
  getMonthlyTrends: mockGetMonthlyTrends,
  getOptimizationBreakdown: mockGetOptimizationBreakdown,
}));
vi.mock("../../app/services/seo-audit.server", () => ({
  auditProducts: mockAuditProducts,
}));

import { mockSession, mockAnalytics } from "./test-utils";

describe("Reports Route Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should fetch analytics data for reports page", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockGetDashboardAnalytics.mockResolvedValue(mockAnalytics);
      mockGetMonthlyTrends.mockResolvedValue([
        { month: "2026-01", optimizations: 100, products: 50 },
        { month: "2025-12", optimizations: 80, products: 40 },
      ]);
      mockGetOptimizationBreakdown.mockResolvedValue([
        { field: "meta_title", count: 50, percentage: 50 },
        { field: "meta_description", count: 50, percentage: 50 },
      ]);

      const { loader } = await import("../../app/routes/app.reports");
      const request = new Request("http://localhost/app/reports");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.analytics.totalOptimizations).toBe(100);
      expect(data.analytics.seoHealthScore).toBe(75);
      expect(data.monthlyTrends).toHaveLength(2);
      expect(data.breakdown).toHaveLength(2);
    });
  });

  describe("action", () => {
    it("should generate SEO audit CSV report", async () => {
      const mockAdmin = {
        graphql: vi.fn().mockResolvedValue({
          json: () =>
            Promise.resolve({
              data: {
                products: {
                  edges: [
                    {
                      node: {
                        id: "gid://shopify/Product/1",
                        title: "Test Product",
                        handle: "test-product",
                        descriptionHtml: "<p>Description</p>",
                        seo: { title: "SEO Title", description: "Meta desc" },
                        images: { edges: [] },
                      },
                    },
                  ],
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
        results: [
          {
            productId: "gid://shopify/Product/1",
            productTitle: "Test Product",
            score: 100,
            issues: [],
          },
        ],
        stats: {
          totalProducts: 1,
          avgScore: 100,
          criticalCount: 0,
          optimizedCount: 1,
        },
      });

      const { action } = await import("../../app/routes/app.reports");

      const formData = new FormData();
      formData.append("reportType", "seo-audit");

      const request = new Request("http://localhost/app/reports", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.reportType).toBe("seo-audit");
      expect(data.csv).toBeDefined();
      expect(data.csv).toContain("Product ID");
      expect(data.stats.totalProducts).toBe(1);
    });

    it("should generate optimization history CSV report", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockPrisma.optimizationLog.findMany.mockResolvedValue([
        {
          id: "log-1",
          productId: "gid://shopify/Product/1",
          productTitle: "Test Product",
          field: "meta_description",
          oldValue: "",
          newValue: "New description",
          isReverted: false,
          createdAt: new Date("2026-01-15"),
          job: { type: "META_DESCRIPTION" },
        },
      ]);

      const { action } = await import("../../app/routes/app.reports");

      const formData = new FormData();
      formData.append("reportType", "optimization-history");

      const request = new Request("http://localhost/app/reports", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.reportType).toBe("optimization-history");
      expect(data.csv).toBeDefined();
      expect(data.csv).toContain("Date");
      expect(data.csv).toContain("Product ID");
      expect(data.stats.totalRecords).toBe(1);
    });

    it("should generate monthly summary CSV report", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockGetDashboardAnalytics.mockResolvedValue(mockAnalytics);
      mockGetMonthlyTrends.mockResolvedValue([
        { month: "2026-01", optimizations: 100, products: 50 },
      ]);
      mockGetOptimizationBreakdown.mockResolvedValue([
        { field: "meta_description", count: 100, percentage: 100 },
      ]);

      const { action } = await import("../../app/routes/app.reports");

      const formData = new FormData();
      formData.append("reportType", "monthly-summary");

      const request = new Request("http://localhost/app/reports", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.reportType).toBe("monthly-summary");
      expect(data.csv).toBeDefined();
      expect(data.csv).toContain("Monthly Summary");
      expect(data.stats.totalOptimizations).toBe(100);
    });

    it("should handle invalid report type", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      const { action } = await import("../../app/routes/app.reports");

      const formData = new FormData();
      formData.append("reportType", "invalid-type");

      const request = new Request("http://localhost/app/reports", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });
});
