/**
 * SEO Audit Service
 * Analyzes products for SEO issues and calculates health scores
 */

export interface SeoIssue {
  field: "metaTitle" | "metaDescription" | "altText" | "productDescription";
  severity: "critical" | "warning" | "info";
  message: string;
  currentValue?: string;
  recommendation?: string;
}

export interface SeoAuditResult {
  productId: string;
  productTitle: string;
  score: number; // 0-100
  issues: SeoIssue[];
}

export interface StoreAuditStats {
  totalProducts: number;
  avgScore: number;
  criticalCount: number;
  warningCount: number;
  optimizedCount: number; // Score >= 80
}

interface ProductForAudit {
  id: string;
  title: string;
  descriptionHtml: string | null;
  seo: {
    title: string | null;
    description: string | null;
  };
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
  }>;
}

/**
 * Audit a single product for SEO issues
 */
export function auditProduct(product: ProductForAudit): SeoAuditResult {
  const issues: SeoIssue[] = [];
  let score = 100;

  // =====================
  // Meta Title (30 points)
  // =====================
  if (!product.seo.title || product.seo.title.trim() === "") {
    issues.push({
      field: "metaTitle",
      severity: "critical",
      message: "Missing SEO title",
      recommendation: "Add an SEO title between 50-60 characters",
    });
    score -= 30;
  } else {
    const titleLength = product.seo.title.length;

    if (titleLength < 30) {
      issues.push({
        field: "metaTitle",
        severity: "warning",
        message: `SEO title too short (${titleLength} chars)`,
        currentValue: product.seo.title,
        recommendation: "SEO titles should be 50-60 characters for best results",
      });
      score -= 10;
    } else if (titleLength > 60) {
      issues.push({
        field: "metaTitle",
        severity: "warning",
        message: `SEO title too long (${titleLength} chars) - may be truncated`,
        currentValue: product.seo.title.slice(0, 50) + "...",
        recommendation: "Keep SEO titles under 60 characters to prevent truncation",
      });
      score -= 5;
    }
  }

  // ========================
  // Meta Description (40 points)
  // ========================
  if (!product.seo.description || product.seo.description.trim() === "") {
    issues.push({
      field: "metaDescription",
      severity: "critical",
      message: "Missing meta description",
      recommendation: "Add a meta description between 130-160 characters",
    });
    score -= 40;
  } else {
    const descLength = product.seo.description.length;

    if (descLength < 120) {
      issues.push({
        field: "metaDescription",
        severity: "warning",
        message: `Meta description too short (${descLength} chars)`,
        currentValue: product.seo.description,
        recommendation: "Meta descriptions should be 130-160 characters for best results",
      });
      score -= 15;
    } else if (descLength > 160) {
      issues.push({
        field: "metaDescription",
        severity: "info",
        message: `Meta description may be truncated (${descLength} chars)`,
        currentValue: product.seo.description.slice(0, 50) + "...",
        recommendation: "Keep meta descriptions under 160 characters",
      });
      score -= 5;
    }
  }

  // =====================
  // Image Alt Text (30 points)
  // =====================
  if (product.images.length === 0) {
    // No images is not necessarily an issue, but worth noting
    issues.push({
      field: "altText",
      severity: "info",
      message: "Product has no images",
      recommendation: "Consider adding product images with descriptive alt text",
    });
  } else {
    const imagesWithoutAlt = product.images.filter(
      (img) => !img.altText || img.altText.trim() === ""
    );

    if (imagesWithoutAlt.length === product.images.length) {
      // All images missing alt text
      issues.push({
        field: "altText",
        severity: "critical",
        message: `All ${product.images.length} images missing alt text`,
        recommendation: "Add descriptive alt text to all images for accessibility and SEO",
      });
      score -= 30;
    } else if (imagesWithoutAlt.length > 0) {
      // Some images missing alt text
      issues.push({
        field: "altText",
        severity: "warning",
        message: `${imagesWithoutAlt.length} of ${product.images.length} images missing alt text`,
        recommendation: "Add alt text to all images",
      });
      score -= Math.min(20, imagesWithoutAlt.length * 5);
    }
  }

  // ========================
  // Product Description (bonus - not deducted from base score)
  // ========================
  const cleanDescription = (product.descriptionHtml || "")
    .replace(/<[^>]*>/g, "")
    .trim();

  if (!cleanDescription) {
    issues.push({
      field: "productDescription",
      severity: "info",
      message: "Product has no description",
      recommendation: "Add a detailed product description to improve SEO",
    });
  } else if (cleanDescription.length < 100) {
    issues.push({
      field: "productDescription",
      severity: "info",
      message: `Product description is short (${cleanDescription.length} chars)`,
      recommendation: "Consider adding more detail to the product description",
    });
  }

  return {
    productId: product.id,
    productTitle: product.title,
    score: Math.max(0, score),
    issues,
  };
}

/**
 * Audit multiple products and return results with store-wide stats
 */
export function auditProducts(products: ProductForAudit[]): {
  results: SeoAuditResult[];
  stats: StoreAuditStats;
} {
  const results = products.map(auditProduct);

  // Calculate store-wide stats
  const totalProducts = results.length;
  const avgScore =
    totalProducts > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalProducts)
      : 0;

  const criticalCount = results.filter((r) =>
    r.issues.some((i) => i.severity === "critical")
  ).length;

  const warningCount = results.filter(
    (r) =>
      !r.issues.some((i) => i.severity === "critical") &&
      r.issues.some((i) => i.severity === "warning")
  ).length;

  const optimizedCount = results.filter((r) => r.score >= 80).length;

  return {
    results,
    stats: {
      totalProducts,
      avgScore,
      criticalCount,
      warningCount,
      optimizedCount,
    },
  };
}

/**
 * Get a text summary of the audit score
 */
export function getScoreLabel(score: number): {
  label: string;
  tone: "critical" | "warning" | "success";
} {
  if (score >= 80) {
    return { label: "Good", tone: "success" };
  } else if (score >= 50) {
    return { label: "Needs Work", tone: "warning" };
  } else {
    return { label: "Critical", tone: "critical" };
  }
}
