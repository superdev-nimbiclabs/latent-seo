import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockPrisma, mockAuthenticate } = vi.hoisted(() => {
  return {
    mockPrisma: {
      shop: { findUnique: vi.fn() },
      job: { findMany: vi.fn() },
    },
    mockAuthenticate: {
      admin: vi.fn(),
    },
  };
});

// Mock dependencies
vi.mock("../../app/db.server", () => ({ prisma: mockPrisma }));
vi.mock("../../app/shopify.server", () => ({ authenticate: mockAuthenticate }));

import { mockSession, mockJob } from "./test-utils";

describe("Jobs Route Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should fetch jobs for the shop", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      const mockJobs = [
        {
          ...mockJob,
          id: "job-1",
          type: "META_DESCRIPTION",
          status: "COMPLETED",
          processedItems: 50,
          totalItems: 50,
        },
        {
          ...mockJob,
          id: "job-2",
          type: "ALT_TEXT",
          status: "PROCESSING",
          processedItems: 25,
          totalItems: 100,
        },
      ];

      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const { loader } = await import("../../app/routes/app.jobs");
      const request = new Request("http://localhost/app/jobs");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.jobs).toHaveLength(2);
      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shopDomain: mockSession.shop },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      );
    });

    it("should return job statistics", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      const mockJobs = [
        { ...mockJob, id: "job-1", status: "COMPLETED" },
        { ...mockJob, id: "job-2", status: "COMPLETED" },
        { ...mockJob, id: "job-3", status: "PROCESSING" },
        { ...mockJob, id: "job-4", status: "PENDING" },
        { ...mockJob, id: "job-5", status: "FAILED" },
      ];

      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const { loader } = await import("../../app/routes/app.jobs");
      const request = new Request("http://localhost/app/jobs");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.stats).toEqual({
        completed: 2,
        processing: 1,
        pending: 1,
        failed: 1,
      });
    });

    it("should indicate when jobs are active", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      const mockJobs = [
        { ...mockJob, id: "job-1", status: "PROCESSING" },
      ];

      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const { loader } = await import("../../app/routes/app.jobs");
      const request = new Request("http://localhost/app/jobs");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.hasActiveJob).toBe(true);
    });

    it("should indicate when no jobs are active", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      const mockJobs = [
        { ...mockJob, id: "job-1", status: "COMPLETED" },
        { ...mockJob, id: "job-2", status: "FAILED" },
      ];

      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const { loader } = await import("../../app/routes/app.jobs");
      const request = new Request("http://localhost/app/jobs");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.hasActiveJob).toBe(false);
    });

    it("should return empty state when no jobs exist", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockPrisma.job.findMany.mockResolvedValue([]);

      const { loader } = await import("../../app/routes/app.jobs");
      const request = new Request("http://localhost/app/jobs");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.jobs).toHaveLength(0);
      expect(data.stats).toEqual({
        completed: 0,
        processing: 0,
        pending: 0,
        failed: 0,
      });
      expect(data.hasActiveJob).toBe(false);
    });
  });
});
