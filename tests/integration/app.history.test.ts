import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockPrisma, mockAuthenticate, mockGetOptimizationHistory, mockRevertOptimization } = vi.hoisted(() => {
  return {
    mockPrisma: {
      shop: { findUnique: vi.fn() },
      job: { findMany: vi.fn() },
      optimizationLog: { findMany: vi.fn(), count: vi.fn() },
    },
    mockAuthenticate: {
      admin: vi.fn(),
    },
    mockGetOptimizationHistory: vi.fn(),
    mockRevertOptimization: vi.fn(),
  };
});

// Mock dependencies
vi.mock("../../app/db.server", () => ({ prisma: mockPrisma }));
vi.mock("../../app/shopify.server", () => ({ authenticate: mockAuthenticate }));
vi.mock("../../app/services/undo.server", () => ({
  getOptimizationHistory: mockGetOptimizationHistory,
  revertOptimization: mockRevertOptimization,
  revertJob: vi.fn(),
}));

import { mockSession, mockOptimizationLogs } from "./test-utils";

describe("History Route Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mocks for all tests
    mockPrisma.job.findMany.mockResolvedValue([]);
    mockPrisma.optimizationLog.count.mockResolvedValue(0);
  });

  describe("loader", () => {
    it("should fetch optimization history with pagination", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockGetOptimizationHistory.mockResolvedValue({
        logs: mockOptimizationLogs,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });

      const { loader } = await import("../../app/routes/app.history");
      const request = new Request("http://localhost/app/history");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.logs).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
      expect(data.pagination.page).toBe(1);
    });

    it("should handle page parameter from URL", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockGetOptimizationHistory.mockResolvedValue({
        logs: [],
        pagination: {
          page: 2,
          limit: 20,
          total: 50,
          totalPages: 3,
        },
      });

      const { loader } = await import("../../app/routes/app.history");
      const request = new Request("http://localhost/app/history?page=2");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.pagination.page).toBe(2);
    });

    it("should fetch recent jobs for filter dropdown", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      const mockJobs = [
        { id: "job-1", type: "META_DESCRIPTION", createdAt: new Date(), processedItems: 10, status: "COMPLETED" },
      ];
      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      mockGetOptimizationHistory.mockResolvedValue({
        logs: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const { loader } = await import("../../app/routes/app.history");
      const request = new Request("http://localhost/app/history");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.recentJobs).toHaveLength(1);
      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shopDomain: mockSession.shop },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      );
    });
  });

  describe("action", () => {
    it("should revert a single optimization", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockRevertOptimization.mockResolvedValue({
        success: true,
        productId: "gid://shopify/Product/1",
      });

      const { action } = await import("../../app/routes/app.history");

      const formData = new FormData();
      formData.append("intent", "revert");
      formData.append("logId", "log-1");

      const request = new Request("http://localhost/app/history", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.revertSuccess).toBe(true);
      expect(mockRevertOptimization).toHaveBeenCalledWith("log-1", mockSession.shop);
    });

    it("should handle revert error gracefully", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockRevertOptimization.mockRejectedValue(new Error("Product not found"));

      const { action } = await import("../../app/routes/app.history");

      const formData = new FormData();
      formData.append("intent", "revert");
      formData.append("logId", "log-invalid");

      const request = new Request("http://localhost/app/history", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should return error for invalid intent", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      const { action } = await import("../../app/routes/app.history");

      const formData = new FormData();
      formData.append("intent", "invalid");

      const request = new Request("http://localhost/app/history", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid intent");
    });
  });
});
