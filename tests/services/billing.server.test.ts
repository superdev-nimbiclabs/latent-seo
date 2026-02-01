import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      shop: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      subscription: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      usageRecord: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
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

// Mock plans config - need to match actual implementation
vi.mock("../../app/config/plans", () => ({
  PLANS: {
    FREE: {
      id: "FREE",
      name: "Free",
      price: 0,
      features: { productsPerMonth: 25 },
    },
    PRO: {
      id: "PRO",
      name: "Pro",
      price: 29,
      features: { productsPerMonth: 500 },
    },
    ENTERPRISE: {
      id: "ENTERPRISE",
      name: "Enterprise",
      price: 99,
      features: { productsPerMonth: "unlimited" },
    },
  },
  getProductLimit: (planId: string) => {
    const limits: Record<string, number | "unlimited"> = {
      FREE: 25,
      PRO: 500,
      ENTERPRISE: "unlimited",
    };
    const limit = limits[planId] ?? 25;
    return limit === "unlimited" ? null : limit;
  },
}));

import {
  getCurrentBillingPeriod,
  getCurrentUsage,
  incrementUsage,
  canOptimize,
} from "../../app/services/billing.server";

describe("Billing Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCurrentBillingPeriod", () => {
    it("should return current month in YYYY-MM format", () => {
      const period = getCurrentBillingPeriod();
      expect(period).toMatch(/^\d{4}-\d{2}$/);

      const now = new Date();
      const expectedMonth = String(now.getMonth() + 1).padStart(2, "0");
      const expectedYear = now.getFullYear();
      expect(period).toBe(`${expectedYear}-${expectedMonth}`);
    });

    it("should pad single digit months", () => {
      const period = getCurrentBillingPeriod();
      const month = period.split("-")[1];
      expect(month.length).toBe(2);
    });
  });

  describe("getCurrentUsage", () => {
    it("should return usage data for existing record", async () => {
      const mockUsage = {
        productsOptimized: 10,
        metaTitlesGenerated: 5,
        metaDescriptionsGenerated: 8,
        altTextsGenerated: 3,
        schemasGenerated: 2,
      };

      mockPrisma.usageRecord.findUnique.mockResolvedValue({
        id: "usage-1",
        shopDomain: "test.myshopify.com",
        billingPeriod: "2026-01",
        ...mockUsage,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.shop.findUnique.mockResolvedValue({
        shopDomain: "test.myshopify.com",
        plan: "FREE",
      });

      const usage = await getCurrentUsage("test.myshopify.com");

      expect(usage.productsOptimized).toBe(10);
      expect(usage.metaTitlesGenerated).toBe(5);
      expect(usage.limit).toBe(25);
      expect(usage.percentUsed).toBe(40);
    });

    it("should return zero usage for non-existing record", async () => {
      mockPrisma.usageRecord.findUnique.mockResolvedValue(null);
      mockPrisma.shop.findUnique.mockResolvedValue({
        shopDomain: "test.myshopify.com",
        plan: "FREE",
      });

      const usage = await getCurrentUsage("test.myshopify.com");

      expect(usage.productsOptimized).toBe(0);
      expect(usage.metaTitlesGenerated).toBe(0);
      expect(usage.limit).toBe(25);
      expect(usage.percentUsed).toBe(0);
    });

    it("should return null limit for enterprise plan", async () => {
      mockPrisma.usageRecord.findUnique.mockResolvedValue({
        id: "usage-1",
        shopDomain: "test.myshopify.com",
        billingPeriod: "2026-01",
        productsOptimized: 1000,
        metaTitlesGenerated: 500,
        metaDescriptionsGenerated: 500,
        altTextsGenerated: 200,
        schemasGenerated: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.shop.findUnique.mockResolvedValue({
        shopDomain: "test.myshopify.com",
        plan: "ENTERPRISE",
      });

      const usage = await getCurrentUsage("test.myshopify.com");

      expect(usage.limit).toBeNull();
      expect(usage.percentUsed).toBe(0);
    });
  });

  describe("canOptimize", () => {
    it("should allow optimization when under limit", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({
        shopDomain: "test.myshopify.com",
        plan: "FREE",
      });

      mockPrisma.usageRecord.findUnique.mockResolvedValue({
        id: "usage-1",
        shopDomain: "test.myshopify.com",
        billingPeriod: "2026-01",
        productsOptimized: 10,
        metaTitlesGenerated: 0,
        metaDescriptionsGenerated: 0,
        altTextsGenerated: 0,
        schemasGenerated: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await canOptimize("test.myshopify.com");

      expect(result.allowed).toBe(true);
      expect(result.usage).toBe(10);
      expect(result.limit).toBe(25);
    });

    it("should block optimization when at limit", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({
        shopDomain: "test.myshopify.com",
        plan: "FREE",
      });

      mockPrisma.usageRecord.findUnique.mockResolvedValue({
        id: "usage-1",
        shopDomain: "test.myshopify.com",
        billingPeriod: "2026-01",
        productsOptimized: 25,
        metaTitlesGenerated: 0,
        metaDescriptionsGenerated: 0,
        altTextsGenerated: 0,
        schemasGenerated: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await canOptimize("test.myshopify.com");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("reached your monthly limit");
      expect(result.usage).toBe(25);
      expect(result.limit).toBe(25);
    });

    it("should always allow optimization for enterprise plan", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({
        shopDomain: "test.myshopify.com",
        plan: "ENTERPRISE",
      });

      const result = await canOptimize("test.myshopify.com");

      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });

    it("should allow optimization on error (fail open)", async () => {
      mockPrisma.shop.findUnique.mockRejectedValue(new Error("Database error"));

      const result = await canOptimize("test.myshopify.com");

      expect(result.allowed).toBe(true);
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage count", async () => {
      mockPrisma.usageRecord.upsert.mockResolvedValue({
        id: "usage-1",
        shopDomain: "test.myshopify.com",
        billingPeriod: "2026-01",
        productsOptimized: 11,
        metaTitlesGenerated: 0,
        metaDescriptionsGenerated: 0,
        altTextsGenerated: 0,
        schemasGenerated: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await incrementUsage("test.myshopify.com", "productsOptimized", 1);

      expect(mockPrisma.usageRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { productsOptimized: { increment: 1 } },
        })
      );
    });

    it("should not throw on error", async () => {
      mockPrisma.usageRecord.upsert.mockRejectedValue(new Error("Database error"));

      await expect(
        incrementUsage("test.myshopify.com", "productsOptimized", 1)
      ).resolves.not.toThrow();
    });
  });
});
