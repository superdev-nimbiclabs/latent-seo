// SEO Status for product cards and filtering
export enum SeoStatus {
  CRITICAL = "critical",   // Score < 50
  WARNING = "warning",     // Score 50-79
  SUCCESS = "success",     // Score >= 80
}

// Product with SEO data from Shopify GraphQL
export interface ProductWithSeo {
  id: string;
  title: string;
  handle: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  descriptionHtml: string;
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
  images: {
    id: string;
    url: string;
    altText: string | null;
  }[];
  seo: {
    title: string | null;
    description: string | null;
  };
}

// Parsed product for UI display
export interface ProductSeoDisplay extends ProductWithSeo {
  seoScore: number;
  seoStatus: SeoStatus;
  hasTitle: boolean;
  hasMeta: boolean;
}

// Job status from queue
export interface JobStatus {
  id: string;
  state: "waiting" | "active" | "completed" | "failed" | "delayed";
  progress: number | object;
  data: {
    shopDomain: string;
    jobType: "META_DESCRIPTION" | "SCHEMA_INJECTION";
    tone?: string;
    productIds?: string[];
  };
  failedReason?: string;
}

// Active job for progress tracking
export interface ActiveJob {
  id: string;
  type: "META_DESCRIPTION" | "SCHEMA_INJECTION";
  processed: number;
  total: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
}

// Filter options for product list
export type FilterOption = "all" | "missing_title" | "missing_meta" | "optimized";

// Product counts for dashboard stats
export interface ProductCounts {
  total: number;
  missingTitle: number;
  missingMeta: number;
  optimized: number;
}

// Dashboard stats combined
export interface DashboardData {
  productCounts: ProductCounts;
  shopStats: {
    totalOptimized: number;
    totalJobs: number;
    recentLogs: Array<{
      id: string;
      productId: string;
      field: string;
      oldValue: string | null;
      newValue: string;
      createdAt: Date;
      isReverted: boolean;
    }>;
  };
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  activeJob: ActiveJob | null;
}

// Pagination info from Shopify
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

// Settings for shop
export interface ShopSettings {
  aiTone: "PROFESSIONAL" | "FUN" | "URGENT" | "LUXURY";
  autoPublish: boolean;
}
