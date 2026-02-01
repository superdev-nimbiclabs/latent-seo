/**
 * SEO Audit Shared Types and Utilities
 * This file can be imported on both client and server
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
