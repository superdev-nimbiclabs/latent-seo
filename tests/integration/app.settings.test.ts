import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockPrisma, mockAuthenticate, mockGetOrCreateShop, mockUpdateShopSettings } = vi.hoisted(() => {
  return {
    mockPrisma: {
      shop: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    },
    mockAuthenticate: {
      admin: vi.fn(),
    },
    mockGetOrCreateShop: vi.fn(),
    mockUpdateShopSettings: vi.fn(),
  };
});

// Mock dependencies
vi.mock("../../app/db.server", () => ({ prisma: mockPrisma }));
vi.mock("../../app/shopify.server", () => ({ authenticate: mockAuthenticate }));
vi.mock("../../app/services/shop.server", () => ({
  getOrCreateShop: mockGetOrCreateShop,
  updateShopSettings: mockUpdateShopSettings,
}));

import { mockSession, mockShop } from "./test-utils";

describe("Settings Route Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should fetch shop settings", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockGetOrCreateShop.mockResolvedValue({
        ...mockShop,
        aiTone: "PROFESSIONAL",
        autoPublish: true,
        customMetaTitlePrompt: null,
        customMetaDescriptionPrompt: "Focus on quality and value",
        customAltTextPrompt: null,
        notifyOnJobComplete: true,
        notificationEmail: "test@example.com",
        excludedTags: ["draft", "hidden"],
        excludedCollections: [],
      });

      const { loader } = await import("../../app/routes/app.settings");
      const request = new Request("http://localhost/app/settings");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.aiTone).toBe("PROFESSIONAL");
      expect(data.autoPublish).toBe(true);
      expect(data.customMetaDescriptionPrompt).toBe("Focus on quality and value");
      expect(data.notifyOnJobComplete).toBe(true);
      expect(data.excludedTags).toEqual(["draft", "hidden"]);
      expect(mockGetOrCreateShop).toHaveBeenCalledWith(mockSession.shop);
    });

    it("should return default values for new shop", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockGetOrCreateShop.mockResolvedValue({
        shopDomain: mockSession.shop,
        plan: "FREE",
        aiTone: "PROFESSIONAL",
        autoPublish: false,
        customMetaTitlePrompt: null,
        customMetaDescriptionPrompt: null,
        customAltTextPrompt: null,
        notifyOnJobComplete: false,
        notificationEmail: null,
        excludedTags: [],
        excludedCollections: [],
      });

      const { loader } = await import("../../app/routes/app.settings");
      const request = new Request("http://localhost/app/settings");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.aiTone).toBe("PROFESSIONAL");
      expect(data.autoPublish).toBe(false);
      expect(data.excludedTags).toEqual([]);
    });
  });

  describe("action", () => {
    it("should update shop settings", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockUpdateShopSettings.mockResolvedValue({
        ...mockShop,
        aiTone: "LUXURY",
        autoPublish: true,
      });

      const { action } = await import("../../app/routes/app.settings");

      const formData = new FormData();
      formData.append("aiTone", "LUXURY");
      formData.append("autoPublish", "true");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(mockUpdateShopSettings).toHaveBeenCalledWith(
        mockSession.shop,
        expect.objectContaining({
          aiTone: "LUXURY",
          autoPublish: true,
        })
      );
    });

    it("should parse excluded tags from comma-separated string", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockUpdateShopSettings.mockResolvedValue(mockShop);

      const { action } = await import("../../app/routes/app.settings");

      const formData = new FormData();
      formData.append("aiTone", "PROFESSIONAL");
      formData.append("excludedTags", "draft, hidden, test");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(mockUpdateShopSettings).toHaveBeenCalledWith(
        mockSession.shop,
        expect.objectContaining({
          excludedTags: ["draft", "hidden", "test"],
        })
      );
    });

    it("should handle custom prompts", async () => {
      mockAuthenticate.admin.mockResolvedValue({
        admin: {},
        session: mockSession,
      });

      mockUpdateShopSettings.mockResolvedValue(mockShop);

      const { action } = await import("../../app/routes/app.settings");

      const formData = new FormData();
      formData.append("aiTone", "PROFESSIONAL");
      formData.append("customMetaTitlePrompt", "Always include brand name");
      formData.append("customMetaDescriptionPrompt", "Focus on benefits");

      const request = new Request("http://localhost/app/settings", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {} });

      expect(mockUpdateShopSettings).toHaveBeenCalledWith(
        mockSession.shop,
        expect.objectContaining({
          customMetaTitlePrompt: "Always include brand name",
          customMetaDescriptionPrompt: "Focus on benefits",
        })
      );
    });
  });
});
