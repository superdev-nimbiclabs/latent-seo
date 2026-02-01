import { prisma } from "../db.server";

/**
 * Analytics data for the dashboard
 */
export interface DashboardAnalytics {
  // Overall stats
  totalOptimizations: number;
  totalProductsOptimized: number;
  totalJobs: number;

  // This month stats
  thisMonthOptimizations: number;
  thisMonthProducts: number;
  thisMonthJobs: number;

  // By type
  metaTitlesGenerated: number;
  metaDescriptionsGenerated: number;
  altTextsGenerated: number;

  // SEO Health
  seoHealthScore: number;

  // Trends (last 7 days)
  dailyTrends: DailyTrend[];

  // Recent activity
  recentActivity: RecentActivity[];
}

export interface DailyTrend {
  date: string; // YYYY-MM-DD
  optimizations: number;
  products: number;
}

export interface RecentActivity {
  id: string;
  type: "optimization" | "job_complete" | "undo";
  description: string;
  timestamp: Date;
  productTitle?: string;
}

/**
 * Get comprehensive analytics for the dashboard
 */
export async function getDashboardAnalytics(shopDomain: string): Promise<DashboardAnalytics> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch all analytics data in parallel
  const [
    totalOptimizations,
    totalJobs,
    thisMonthOptimizations,
    thisMonthJobs,
    usageRecord,
    dailyOptimizations,
    recentLogs,
    recentJobCompletions,
  ] = await Promise.all([
    // Total optimizations (non-reverted)
    prisma.optimizationLog.count({
      where: { shopDomain, isReverted: false },
    }),

    // Total jobs
    prisma.job.count({
      where: { shopDomain },
    }),

    // This month optimizations
    prisma.optimizationLog.count({
      where: {
        shopDomain,
        isReverted: false,
        createdAt: { gte: startOfMonth },
      },
    }),

    // This month jobs
    prisma.job.count({
      where: {
        shopDomain,
        createdAt: { gte: startOfMonth },
      },
    }),

    // Usage record for this month
    prisma.usageRecord.findUnique({
      where: {
        shopDomain_billingPeriod: {
          shopDomain,
          billingPeriod: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        },
      },
    }),

    // Daily optimizations for trend chart (last 7 days)
    prisma.optimizationLog.groupBy({
      by: ["createdAt"],
      where: {
        shopDomain,
        isReverted: false,
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    }),

    // Recent optimization logs
    prisma.optimizationLog.findMany({
      where: { shopDomain },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        field: true,
        productTitle: true,
        isReverted: true,
        createdAt: true,
      },
    }),

    // Recent job completions
    prisma.job.findMany({
      where: {
        shopDomain,
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        processedItems: true,
        completedAt: true,
      },
    }),
  ]);

  // Calculate unique products optimized
  const uniqueProducts = await prisma.optimizationLog.groupBy({
    by: ["productId"],
    where: { shopDomain, isReverted: false },
  });
  const totalProductsOptimized = uniqueProducts.length;

  // This month unique products
  const thisMonthUniqueProducts = await prisma.optimizationLog.groupBy({
    by: ["productId"],
    where: {
      shopDomain,
      isReverted: false,
      createdAt: { gte: startOfMonth },
    },
  });
  const thisMonthProducts = thisMonthUniqueProducts.length;

  // Process daily trends
  const dailyTrends = processDailyTrends(dailyOptimizations, sevenDaysAgo);

  // Process recent activity
  const recentActivity = processRecentActivity(recentLogs, recentJobCompletions);

  // Calculate SEO health score (would need product data for accurate score)
  // For now, use a simplified calculation based on optimization coverage
  const seoHealthScore = calculateSimplifiedHealthScore(totalProductsOptimized, totalOptimizations);

  return {
    totalOptimizations,
    totalProductsOptimized,
    totalJobs,
    thisMonthOptimizations,
    thisMonthProducts,
    thisMonthJobs,
    metaTitlesGenerated: usageRecord?.metaTitlesGenerated || 0,
    metaDescriptionsGenerated: usageRecord?.metaDescriptionsGenerated || 0,
    altTextsGenerated: usageRecord?.altTextsGenerated || 0,
    seoHealthScore,
    dailyTrends,
    recentActivity,
  };
}

/**
 * Process raw daily optimization data into trend format
 */
function processDailyTrends(
  rawData: { createdAt: Date; _count: number }[],
  startDate: Date
): DailyTrend[] {
  const trends: DailyTrend[] = [];
  const dataByDate = new Map<string, number>();

  // Group by date
  for (const item of rawData) {
    const dateKey = item.createdAt.toISOString().split("T")[0];
    dataByDate.set(dateKey, (dataByDate.get(dateKey) || 0) + item._count);
  }

  // Generate 7 days of data
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split("T")[0];
    trends.push({
      date: dateKey,
      optimizations: dataByDate.get(dateKey) || 0,
      products: 0, // Would need separate query for unique products per day
    });
  }

  return trends;
}

/**
 * Process recent logs and jobs into activity feed
 */
function processRecentActivity(
  logs: {
    id: string;
    field: string;
    productTitle: string | null;
    isReverted: boolean;
    createdAt: Date;
  }[],
  jobs: {
    id: string;
    type: string;
    processedItems: number;
    completedAt: Date | null;
  }[]
): RecentActivity[] {
  const activities: RecentActivity[] = [];

  // Add optimization logs
  for (const log of logs) {
    const fieldName = {
      meta_title: "meta title",
      meta_description: "meta description",
      alt_text: "alt text",
    }[log.field] || log.field;

    activities.push({
      id: log.id,
      type: log.isReverted ? "undo" : "optimization",
      description: log.isReverted
        ? `Reverted ${fieldName} for ${log.productTitle || "product"}`
        : `Generated ${fieldName} for ${log.productTitle || "product"}`,
      timestamp: log.createdAt,
      productTitle: log.productTitle || undefined,
    });
  }

  // Add job completions
  for (const job of jobs) {
    if (job.completedAt) {
      const jobTypeName = {
        META_DESCRIPTION: "SEO optimization",
        ALT_TEXT: "alt text generation",
        SCHEMA_INJECTION: "schema injection",
      }[job.type] || job.type;

      activities.push({
        id: `job-${job.id}`,
        type: "job_complete",
        description: `Completed ${jobTypeName} job (${job.processedItems} items)`,
        timestamp: job.completedAt,
      });
    }
  }

  // Sort by timestamp (newest first) and limit
  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);
}

/**
 * Calculate a simplified SEO health score
 * In production, this would analyze actual product SEO data
 */
function calculateSimplifiedHealthScore(
  productsOptimized: number,
  totalOptimizations: number
): number {
  if (productsOptimized === 0) return 0;

  // Simple heuristic: more optimizations per product = better coverage
  const avgOptimizationsPerProduct = totalOptimizations / productsOptimized;

  // Assume 3 optimizations per product (title, description, alt text) = 100%
  const score = Math.min(100, Math.round((avgOptimizationsPerProduct / 3) * 100));

  return score;
}

/**
 * Get monthly optimization trends for the past 6 months
 */
export async function getMonthlyTrends(shopDomain: string): Promise<{
  month: string;
  optimizations: number;
  products: number;
}[]> {
  const trends = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const [optimizations, uniqueProducts] = await Promise.all([
      prisma.optimizationLog.count({
        where: {
          shopDomain,
          isReverted: false,
          createdAt: {
            gte: date,
            lt: nextMonth,
          },
        },
      }),
      prisma.optimizationLog.groupBy({
        by: ["productId"],
        where: {
          shopDomain,
          isReverted: false,
          createdAt: {
            gte: date,
            lt: nextMonth,
          },
        },
      }),
    ]);

    trends.push({
      month: monthKey,
      optimizations,
      products: uniqueProducts.length,
    });
  }

  return trends;
}

/**
 * Get optimization breakdown by field type
 */
export async function getOptimizationBreakdown(shopDomain: string): Promise<{
  field: string;
  count: number;
  percentage: number;
}[]> {
  const breakdown = await prisma.optimizationLog.groupBy({
    by: ["field"],
    where: { shopDomain, isReverted: false },
    _count: true,
  });

  const total = breakdown.reduce((sum, item) => sum + item._count, 0);

  return breakdown.map((item) => ({
    field: item.field,
    count: item._count,
    percentage: total > 0 ? Math.round((item._count / total) * 100) : 0,
  }));
}
