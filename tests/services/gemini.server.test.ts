import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock for generateContent
const { mockGenerateContent } = vi.hoisted(() => {
  return { mockGenerateContent: vi.fn() };
});

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      constructor(_apiKey: string) {}
      getGenerativeModel(_config: any) {
        return {
          generateContent: mockGenerateContent,
        };
      }
    },
  };
});

import {
  generateMetaDescription,
  generateMetaTitle,
  TONE_PROMPTS,
} from "../../app/services/gemini.server";

describe("Gemini Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TONE_PROMPTS", () => {
    it("should have all required tones", () => {
      expect(TONE_PROMPTS).toHaveProperty("PROFESSIONAL");
      expect(TONE_PROMPTS).toHaveProperty("FUN");
      expect(TONE_PROMPTS).toHaveProperty("URGENT");
      expect(TONE_PROMPTS).toHaveProperty("LUXURY");
    });

    it("should have non-empty tone instructions", () => {
      Object.values(TONE_PROMPTS).forEach((prompt) => {
        expect(prompt.length).toBeGreaterThan(10);
      });
    });
  });

  describe("generateMetaDescription", () => {
    const mockProduct = {
      title: "Premium Leather Wallet",
      description: "<p>Handcrafted <strong>genuine leather</strong> wallet with RFID protection.</p>",
      vendor: "LeatherCraft Co",
      tags: ["wallet", "leather", "mens", "accessories", "gift"],
      price: "$49.99",
    };

    it("should generate a valid meta description", async () => {
      const mockResponse = "Discover our handcrafted genuine leather wallet with RFID protection. Premium quality from LeatherCraft Co. Shop now for the perfect gift.";

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => mockResponse,
        },
      });

      const result = await generateMetaDescription(mockProduct, "PROFESSIONAL");

      expect(result).toBe(mockResponse);
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("should return null for empty response", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "",
        },
      });

      const result = await generateMetaDescription(mockProduct, "PROFESSIONAL");

      expect(result).toBeNull();
    });

    it("should return null for too short response", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "Too short",
        },
      });

      const result = await generateMetaDescription(mockProduct, "PROFESSIONAL");

      expect(result).toBeNull();
    });

    it("should truncate response over 160 characters", async () => {
      const longResponse =
        "This is an extremely long meta description that goes way beyond the recommended 160 character limit and needs to be truncated to ensure proper display in search results without breaking words.";

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => longResponse,
        },
      });

      const result = await generateMetaDescription(mockProduct, "PROFESSIONAL");

      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThanOrEqual(160);
      expect(result!.endsWith("...")).toBe(true);
    });

    it("should remove quotes from response", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            '"Discover our handcrafted genuine leather wallet with RFID protection. Premium quality from LeatherCraft Co."',
        },
      });

      const result = await generateMetaDescription(mockProduct, "PROFESSIONAL");

      expect(result).not.toBeNull();
      expect(result!.startsWith('"')).toBe(false);
      expect(result!.endsWith('"')).toBe(false);
    });

    it("should remove markdown formatting", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            "**Discover** our *handcrafted* leather wallet with RFID protection. Premium quality crafted for the modern professional.",
        },
      });

      const result = await generateMetaDescription(mockProduct, "PROFESSIONAL");

      expect(result).not.toBeNull();
      expect(result!.includes("**")).toBe(false);
      expect(result!.includes("*")).toBe(false);
    });

    it("should use custom prompt when provided", async () => {
      const customPrompt = "Focus on sustainability and eco-friendly materials.";

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            "Shop our eco-friendly leather wallet, sustainably crafted with care. Perfect for the environmentally conscious consumer. Order today.",
        },
      });

      await generateMetaDescription(mockProduct, "PROFESSIONAL", customPrompt);

      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      mockGenerateContent.mockRejectedValue(new Error("API rate limit exceeded"));

      const result = await generateMetaDescription(mockProduct, "PROFESSIONAL");

      expect(result).toBeNull();
    });
  });

  describe("generateMetaTitle", () => {
    const mockProduct = {
      title: "Premium Leather Wallet",
      description: "Handcrafted genuine leather wallet with RFID protection.",
      vendor: "LeatherCraft Co",
      tags: ["wallet", "leather", "mens"],
      price: "$49.99",
    };

    it("should generate a valid meta title", async () => {
      const mockResponse = "Premium Leather Wallet - RFID Protected | LeatherCraft";

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => mockResponse,
        },
      });

      const result = await generateMetaTitle(mockProduct, "PROFESSIONAL");

      expect(result).toBe(mockResponse);
    });

    it("should return null for empty response", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "",
        },
      });

      const result = await generateMetaTitle(mockProduct, "PROFESSIONAL");

      expect(result).toBeNull();
    });

    it("should return null for too short response", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "Short",
        },
      });

      const result = await generateMetaTitle(mockProduct, "PROFESSIONAL");

      expect(result).toBeNull();
    });

    it("should truncate response over 60 characters", async () => {
      const longResponse =
        "This Is An Extremely Long Meta Title That Goes Way Beyond The Recommended 60 Character Limit";

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => longResponse,
        },
      });

      const result = await generateMetaTitle(mockProduct, "PROFESSIONAL");

      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThanOrEqual(60);
    });

    it("should handle API errors gracefully", async () => {
      mockGenerateContent.mockRejectedValue(new Error("Network error"));

      const result = await generateMetaTitle(mockProduct, "PROFESSIONAL");

      expect(result).toBeNull();
    });
  });
});
