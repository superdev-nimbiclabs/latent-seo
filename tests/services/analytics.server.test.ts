import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("../../app/db.server", () => ({
  prisma: {
    optimizationLog: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    job: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    usageRecord: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../../app/db.server";
import {
  getDashboardAnalytics,
  getMonthlyTrends,
  getOptimizationBreakdown,
} from "../../app/services/analytics.server";

describe("Analytics Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDashboardAnalytics", () => {
    it("should return comprehensive analytics data", async () => {
      // Mock total optimizations
      vi.mocked(prisma.optimizationLog.count)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(25); // this month

      // Mock total jobs
      vi.mocked(prisma.job.count)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3); // this month

      // Mock usage record
      vi.mocked(prisma.usageRecord.findUnique).mockResolvedValue({
        id: "usage-1",
        shopDomain: "test.myshopify.com",
        billingPeriod: "2026-01",
        productsOptimized: 50,
        metaTitlesGenerated: 30,
        metaDescriptionsGenerated: 50,
        altTextsGenerated: 20,
        schemasGenerated: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock daily optimizations
      vi.mocked(prisma.optimizationLog.groupBy).mockResolvedValueOnce([
        { createdAt: new Date("2026-01-28"), _count: 5 },
        { createdAt: new Date("2026-01-29"), _count: 8 },
        { createdAt: new Date("2026-01-30"), _count: 12 },
      ] as any);

      // Mock recent logs
      vi.mocked(prisma.optimizationLog.findMany).mockResolvedValue([
        {
          id: "log-1",
          field: "meta_title",
          productTitle: "Test Product",
          isReverted: false,
          createdAt: new Date(),
        },
      ] as any);

      // Mock recent jobs
      vi.mocked(prisma.job.findMany).mockResolvedValue([
        {
          id: "job-1",
          type: "META_DESCRIPTION",
          processedItems: 50,
          completedAt: new Date(),
        },
      ] as any);

      // Mock unique products
      vi.mocked(prisma.optimizationLog.groupBy)
        .mockResolvedValueOnce([
          { productId: "prod-1" },
          { productId: "prod-2" },
          { productId: "prod-3" },
        ] as any) // total unique
        .mockResolvedValueOnce([
          { productId: "prod-1" },
          { productId: "prod-2" },
        ] as any); // this month unique

      const result = await getDashboardAnalytics("test.myshopify.com");

      expect(result.totalOptimizations).toBe(100);
      expect(result.totalJobs).toBe(10);
      expect(result.metaTitlesGenerated).toBe(30);
      expect(result.metaDescriptionsGenerated).toBe(50);
      expect(result.dailyTrends).toBeDefined();
      expect(result.recentActivity).toBeDefined();
    });

    it("should handle empty data gracefully", async () => {
      vi.mocked(prisma.optimizationLog.count).mockResolvedValue(0);
      vi.mocked(prisma.job.count).mockResolvedValue(0);
      vi.mocked(prisma.usageRecord.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.optimizationLog.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.optimizationLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.job.findMany).mockResolvedValue([]);

      const result = await getDashboardAnalytics("test.myshopify.com");

      expect(result.totalOptimizations).toBe(0);
      expect(result.totalProductsOptimized).toBe(0);
      expect(result.seoHealthScore).toBe(0);
      expect(result.dailyTrends).toHaveLength(7); // Should still have 7 days
    });

    it("should calculate SEO health score correctly", async () => {
      vi.mocked(prisma.optimizationLog.count)
        .mockResolvedValueOnce(30) // 30 total optimizations
        .mockResolvedValueOnce(10);
      vi.mocked(prisma.job.count).mockResolvedValue(5);
      vi.mocked(prisma.usageRecord.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.optimizationLog.groupBy)
        .mockResolvedValueOnce([]) // daily
        .mockResolvedValueOnce([
          { productId: "prod-1" },
          { productId: "prod-2" },
          { productId: "prod-3" },
          { productId: "prod-4" },
          { productId: "prod-5" },
          { productId: "prod-6" },
          { productId: "prod-7" },
          { productId: "prod-8" },
          { productId: "prod-9" },
          { productId: "prod-10" },
        ] as any) // 10 unique products
        .mockResolvedValueOnce([]);
      vi.mocked(prisma.optimizationLog.findMany).mockResolvedValue([]);
      vi.mocked(prisma.job.findMany).mockResolvedValue([]);

      const result = await getDashboardAnalytics("test.myshopify.com");

      // 30 optimizations / 10 products = 3 avg optimizations per product
      // 3 / 3 (target) * 100 = 100% score
      expect(result.seoHealthScore).toBe(100);
    });
  });

  describe("getMonthlyTrends", () => {
    it("should return 6 months of trends", async () => {
      // Mock for each month
      vi.mocked(prisma.optimizationLog.count).mockResolvedValue(10);
      vi.mocked(prisma.optimizationLog.groupBy).mockResolvedValue([
        { productId: "prod-1" },
        { productId: "prod-2" },
      ] as any);

      const result = await getMonthlyTrends("test.myshopify.com");

      expect(result).toHaveLength(6);
      result.forEach((month) => {
        expect(month).toHaveProperty("month");
        expect(month).toHaveProperty("optimizations");
        expect(month).toHaveProperty("products");
        expect(month.month).toMatch(/^\d{4}-\d{2}$/);
      });
    });

    it("should return zeros for months with no data", async () => {
      vi.mocked(prisma.optimizationLog.count).mockResolvedValue(0);
      vi.mocked(prisma.optimizationLog.groupBy).mockResolvedValue([]);

      const result = await getMonthlyTrends("test.myshopify.com");

      expect(result).toHaveLength(6);
      result.forEach((month) => {
        expect(month.optimizations).toBe(0);
        expect(month.products).toBe(0);
      });
    });
  });

  describe("getOptimizationBreakdown", () => {
    it("should return breakdown by field type", async () => {
      vi.mocked(prisma.optimizationLog.groupBy).mockResolvedValue([
        { field: "meta_title", _count: 30 },
        { field: "meta_description", _count: 50 },
        { field: "alt_text", _count: 20 },
      ] as any);

      const result = await getOptimizationBreakdown("test.myshopify.com");

      expect(result).toHaveLength(3);
      expect(result).toContainEqual({
        field: "meta_title",
        count: 30,
        percentage: 30,
      });
      expect(result).toContainEqual({
        field: "meta_description",
        count: 50,
        percentage: 50,
      });
      expect(result).toContainEqual({
        field: "alt_text",
        count: 20,
        percentage: 20,
      });
    });

    it("should handle empty breakdown", async () => {
      vi.mocked(prisma.optimizationLog.groupBy).mockResolvedValue([]);

      const result = await getOptimizationBreakdown("test.myshopify.com");

      expect(result).toHaveLength(0);
    });

    it("should calculate percentages correctly", async () => {
      vi.mocked(prisma.optimizationLog.groupBy).mockResolvedValue([
        { field: "meta_title", _count: 25 },
        { field: "meta_description", _count: 75 },
      ] as any);

      const result = await getOptimizationBreakdown("test.myshopify.com");

      const metaTitle = result.find((r) => r.field === "meta_title");
      const metaDesc = result.find((r) => r.field === "meta_description");

      expect(metaTitle?.percentage).toBe(25);
      expect(metaDesc?.percentage).toBe(75);
    });
  });
});
