import { describe, it, expect } from "vitest";
import {
  auditProduct,
  auditProducts,
  getScoreLabel,
  type SeoAuditResult,
} from "../../app/services/seo-audit.server";

// Valid meta description exactly 145 chars (within 130-160 range)
const VALID_DESCRIPTION = "Discover our premium product with exceptional quality and value. Perfect for your needs with fast shipping and satisfaction guaranteed always.";
// Valid SEO title exactly 55 chars (within 50-60 range)
const VALID_TITLE = "Premium Product - Quality Guaranteed with Fast Shipping";

describe("SEO Audit Service", () => {
  describe("auditProduct", () => {
    it("should return perfect score for fully optimized product", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: "<p>This is a detailed product description that provides all the information a customer needs to make a purchase decision.</p>",
        seo: {
          title: VALID_TITLE,
          description: VALID_DESCRIPTION,
        },
        images: [
          {
            id: "gid://shopify/ProductImage/1",
            url: "https://example.com/image1.jpg",
            altText: "Test Product front view showing premium quality finish",
          },
          {
            id: "gid://shopify/ProductImage/2",
            url: "https://example.com/image2.jpg",
            altText: "Test Product side angle with detailed features",
          },
        ],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
      expect(result.productId).toBe("gid://shopify/Product/123");
      expect(result.productTitle).toBe("Test Product");
    });

    it("should detect missing meta title (critical)", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: "<p>Description</p>",
        seo: {
          title: null,
          description: VALID_DESCRIPTION,
        },
        images: [],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(70); // 100 - 30 for missing title
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "metaTitle",
          severity: "critical",
          message: "Missing SEO title",
        })
      );
    });

    it("should detect short meta title (warning)", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: "<p>Description</p>",
        seo: {
          title: "Short Title",
          description: VALID_DESCRIPTION,
        },
        images: [],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(90); // 100 - 10 for short title
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "metaTitle",
          severity: "warning",
          message: expect.stringContaining("too short"),
        })
      );
    });

    it("should detect long meta title (warning)", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: "<p>Description</p>",
        seo: {
          title:
            "This is a very long meta title that exceeds the recommended 60 characters limit and will likely be truncated by search engines",
          description: VALID_DESCRIPTION,
        },
        images: [],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(95); // 100 - 5 for long title
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "metaTitle",
          severity: "warning",
          message: expect.stringContaining("too long"),
        })
      );
    });

    it("should detect missing meta description (critical)", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: "<p>Description</p>",
        seo: {
          title: VALID_TITLE,
          description: null,
        },
        images: [],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(60); // 100 - 40 for missing description
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "metaDescription",
          severity: "critical",
          message: "Missing meta description",
        })
      );
    });

    it("should detect short meta description (warning)", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: "<p>Description</p>",
        seo: {
          title: VALID_TITLE,
          description: "Short description that is under 120 characters.",
        },
        images: [],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(85); // 100 - 15 for short description
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "metaDescription",
          severity: "warning",
          message: expect.stringContaining("too short"),
        })
      );
    });

    it("should detect all images missing alt text (critical)", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: "<p>Description</p>",
        seo: {
          title: VALID_TITLE,
          description: VALID_DESCRIPTION,
        },
        images: [
          { id: "img-1", url: "https://example.com/1.jpg", altText: null },
          { id: "img-2", url: "https://example.com/2.jpg", altText: "" },
          { id: "img-3", url: "https://example.com/3.jpg", altText: "   " },
        ],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(70); // 100 - 30 for all images missing alt
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "altText",
          severity: "critical",
          message: expect.stringContaining("All 3 images missing alt text"),
        })
      );
    });

    it("should detect some images missing alt text (warning)", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: "<p>Description</p>",
        seo: {
          title: VALID_TITLE,
          description: VALID_DESCRIPTION,
        },
        images: [
          { id: "img-1", url: "https://example.com/1.jpg", altText: "Good alt text" },
          { id: "img-2", url: "https://example.com/2.jpg", altText: null },
          { id: "img-3", url: "https://example.com/3.jpg", altText: "" },
        ],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(90); // 100 - 10 (2 images * 5)
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "altText",
          severity: "warning",
          message: "2 of 3 images missing alt text",
        })
      );
    });

    it("should detect missing product description (info)", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: null,
        seo: {
          title: VALID_TITLE,
          description: VALID_DESCRIPTION,
        },
        images: [{ id: "img-1", url: "url", altText: "Good alt text" }],
      };

      const result = auditProduct(product);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: "productDescription",
          severity: "info",
          message: "Product has no description",
        })
      );
      // Info issues don't deduct from score
      expect(result.score).toBe(100);
    });

    it("should return score of 0 for worst case", () => {
      const product = {
        id: "gid://shopify/Product/123",
        title: "Test Product",
        descriptionHtml: null,
        seo: {
          title: null,
          description: null,
        },
        images: [
          { id: "img-1", url: "https://example.com/1.jpg", altText: null },
        ],
      };

      const result = auditProduct(product);

      expect(result.score).toBe(0); // -30 title, -40 description, -30 alt text
    });
  });

  describe("auditProducts", () => {
    it("should calculate correct stats for multiple products", () => {
      const products = [
        // Good product (score 100)
        {
          id: "gid://shopify/Product/1",
          title: "Good Product",
          descriptionHtml: "<p>Detailed product description that is long enough to not trigger a warning about short product descriptions.</p>",
          seo: {
            title: VALID_TITLE,
            description: VALID_DESCRIPTION,
          },
          images: [{ id: "img-1", url: "url", altText: "Good alt text" }],
        },
        // Medium product (score 70 - missing title)
        {
          id: "gid://shopify/Product/2",
          title: "Medium Product",
          descriptionHtml: "<p>Product description that is long enough to pass the checks.</p>",
          seo: {
            title: null,
            description: VALID_DESCRIPTION,
          },
          images: [{ id: "img-2", url: "url", altText: "Alt text" }],
        },
        // Bad product (score 30 - missing title and description)
        {
          id: "gid://shopify/Product/3",
          title: "Bad Product",
          descriptionHtml: null,
          seo: {
            title: null,
            description: null,
          },
          images: [{ id: "img-3", url: "url", altText: "Alt text" }],
        },
      ];

      const { results, stats } = auditProducts(products);

      expect(results).toHaveLength(3);
      expect(stats.totalProducts).toBe(3);
      expect(stats.avgScore).toBe(67); // (100 + 70 + 30) / 3 = 66.67 rounded
      expect(stats.criticalCount).toBe(2); // Products 2 and 3 have critical issues
      expect(stats.warningCount).toBe(0);
      expect(stats.optimizedCount).toBe(1); // Only product 1 has score >= 80
    });

    it("should handle empty product array", () => {
      const { results, stats } = auditProducts([]);

      expect(results).toHaveLength(0);
      expect(stats.totalProducts).toBe(0);
      expect(stats.avgScore).toBe(0);
      expect(stats.criticalCount).toBe(0);
      expect(stats.warningCount).toBe(0);
      expect(stats.optimizedCount).toBe(0);
    });
  });

  describe("getScoreLabel", () => {
    it("should return 'Good' for scores >= 80", () => {
      expect(getScoreLabel(80)).toEqual({ label: "Good", tone: "success" });
      expect(getScoreLabel(100)).toEqual({ label: "Good", tone: "success" });
      expect(getScoreLabel(95)).toEqual({ label: "Good", tone: "success" });
    });

    it("should return 'Needs Work' for scores 50-79", () => {
      expect(getScoreLabel(50)).toEqual({ label: "Needs Work", tone: "warning" });
      expect(getScoreLabel(79)).toEqual({ label: "Needs Work", tone: "warning" });
      expect(getScoreLabel(65)).toEqual({ label: "Needs Work", tone: "warning" });
    });

    it("should return 'Critical' for scores < 50", () => {
      expect(getScoreLabel(0)).toEqual({ label: "Critical", tone: "critical" });
      expect(getScoreLabel(49)).toEqual({ label: "Critical", tone: "critical" });
      expect(getScoreLabel(25)).toEqual({ label: "Critical", tone: "critical" });
    });
  });
});
