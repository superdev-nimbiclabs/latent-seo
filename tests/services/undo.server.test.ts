import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockShopifyGraphQL, mockPrisma } = vi.hoisted(() => {
  return {
    mockShopifyGraphQL: vi.fn(),
    mockPrisma: {
      optimizationLog: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      session: {
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock("../../app/db.server", () => ({
  prisma: mockPrisma,
}));

vi.mock("../../app/services/shopify-api.server", () => ({
  shopifyGraphQL: mockShopifyGraphQL,
}));

import {
  revertOptimization,
  revertJob,
  getOptimizationHistory,
} from "../../app/services/undo.server";

describe("Undo Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("revertOptimization", () => {
    it("should throw error when log not found", async () => {
      mockPrisma.optimizationLog.findFirst.mockResolvedValue(null);

      await expect(
        revertOptimization("log-123", "test.myshopify.com")
      ).rejects.toThrow("Optimization log not found or already reverted");
    });

    it("should throw error when no valid session", async () => {
      mockPrisma.optimizationLog.findFirst.mockResolvedValue({
        id: "log-123",
        shopDomain: "test.myshopify.com",
        jobId: "job-1",
        productId: "gid://shopify/Product/123",
        productTitle: "Test Product",
        field: "meta_title",
        oldValue: "Old Title",
        newValue: "New Title",
        isReverted: false,
        revertedAt: null,
        createdAt: new Date(),
      });

      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(
        revertOptimization("log-123", "test.myshopify.com")
      ).rejects.toThrow("No valid session found");
    });

    it("should revert meta title and preserve description", async () => {
      mockPrisma.optimizationLog.findFirst.mockResolvedValue({
        id: "log-123",
        shopDomain: "test.myshopify.com",
        jobId: "job-1",
        productId: "gid://shopify/Product/123",
        productTitle: "Test Product",
        field: "meta_title",
        oldValue: "Original Title",
        newValue: "AI Generated Title",
        isReverted: false,
        revertedAt: null,
        createdAt: new Date(),
      });

      mockPrisma.session.findFirst.mockResolvedValue({
        id: "session-1",
        shop: "test.myshopify.com",
        accessToken: "token-123",
      });

      // Mock GET product query
      mockShopifyGraphQL.mockResolvedValueOnce({
        product: {
          id: "gid://shopify/Product/123",
          seo: {
            title: "AI Generated Title",
            description: "Existing Description",
          },
        },
      });

      // Mock UPDATE mutation
      mockShopifyGraphQL.mockResolvedValueOnce({
        productUpdate: {
          product: {
            id: "gid://shopify/Product/123",
            seo: {
              title: "Original Title",
              description: "Existing Description",
            },
          },
          userErrors: [],
        },
      });

      mockPrisma.optimizationLog.update.mockResolvedValue({});

      const result = await revertOptimization("log-123", "test.myshopify.com");

      expect(result.success).toBe(true);
      expect(result.productId).toBe("gid://shopify/Product/123");
      expect(mockShopifyGraphQL).toHaveBeenCalledTimes(2);
      expect(mockPrisma.optimizationLog.update).toHaveBeenCalledWith({
        where: { id: "log-123" },
        data: {
          isReverted: true,
          revertedAt: expect.any(Date),
        },
      });
    });

    it("should throw error for unsupported field type", async () => {
      mockPrisma.optimizationLog.findFirst.mockResolvedValue({
        id: "log-123",
        shopDomain: "test.myshopify.com",
        jobId: "job-1",
        productId: "gid://shopify/Product/123",
        productTitle: "Test Product",
        field: "unsupported_field",
        oldValue: "old",
        newValue: "new",
        isReverted: false,
        revertedAt: null,
        createdAt: new Date(),
      });

      mockPrisma.session.findFirst.mockResolvedValue({
        id: "session-1",
        shop: "test.myshopify.com",
        accessToken: "token-123",
      });

      await expect(
        revertOptimization("log-123", "test.myshopify.com")
      ).rejects.toThrow("Unsupported field type: unsupported_field");
    });

    it("should throw error when product not found", async () => {
      mockPrisma.optimizationLog.findFirst.mockResolvedValue({
        id: "log-123",
        shopDomain: "test.myshopify.com",
        jobId: "job-1",
        productId: "gid://shopify/Product/deleted",
        productTitle: "Test Product",
        field: "meta_title",
        oldValue: "Old Title",
        newValue: "New Title",
        isReverted: false,
        revertedAt: null,
        createdAt: new Date(),
      });

      mockPrisma.session.findFirst.mockResolvedValue({
        id: "session-1",
        shop: "test.myshopify.com",
        accessToken: "token-123",
      });

      mockShopifyGraphQL.mockResolvedValueOnce({
        product: null,
      });

      await expect(
        revertOptimization("log-123", "test.myshopify.com")
      ).rejects.toThrow("Product gid://shopify/Product/deleted not found");
    });
  });

  describe("revertJob", () => {
    it("should throw error when no optimizations found", async () => {
      mockPrisma.optimizationLog.findMany.mockResolvedValue([]);

      await expect(
        revertJob("job-123", "test.myshopify.com")
      ).rejects.toThrow("No optimizations found to revert");
    });
  });

  describe("getOptimizationHistory", () => {
    it("should return paginated history", async () => {
      const mockLogs = [
        {
          id: "log-1",
          shopDomain: "test.myshopify.com",
          jobId: "job-1",
          productId: "gid://shopify/Product/1",
          productTitle: "Product 1",
          field: "meta_title",
          oldValue: "Old",
          newValue: "New",
          isReverted: false,
          revertedAt: null,
          createdAt: new Date(),
          job: { type: "META_DESCRIPTION", status: "COMPLETED", createdAt: new Date() },
        },
      ];

      mockPrisma.optimizationLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.optimizationLog.count.mockResolvedValue(50);

      const result = await getOptimizationHistory("test.myshopify.com", {
        page: 1,
        limit: 20,
      });

      expect(result.logs).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 50,
        totalPages: 3,
      });
    });

    it("should filter by job ID", async () => {
      mockPrisma.optimizationLog.findMany.mockResolvedValue([]);
      mockPrisma.optimizationLog.count.mockResolvedValue(0);

      await getOptimizationHistory("test.myshopify.com", {
        jobId: "job-123",
      });

      expect(mockPrisma.optimizationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            jobId: "job-123",
          }),
        })
      );
    });

    it("should use default pagination values", async () => {
      mockPrisma.optimizationLog.findMany.mockResolvedValue([]);
      mockPrisma.optimizationLog.count.mockResolvedValue(0);

      const result = await getOptimizationHistory("test.myshopify.com");

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });
});
