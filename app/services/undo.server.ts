import { prisma } from "../db.server";

/**
 * Revert a single optimization
 */
export async function revertOptimization(logId: string, shopDomain: string) {
  const log = await prisma.optimizationLog.findFirst({
    where: {
      id: logId,
      shopDomain,
      isReverted: false,
    },
  });

  if (!log) {
    throw new Error("Optimization log not found or already reverted");
  }

  // Get session for Shopify API
  const session = await prisma.session.findFirst({
    where: { shop: shopDomain },
  });

  if (!session?.accessToken) {
    throw new Error("No valid session found");
  }

  // TODO: Call Shopify API to revert the change
  // await updateShopifyProduct(shopDomain, session.accessToken, log.productId, log.oldValue);

  // Mark as reverted in database
  await prisma.optimizationLog.update({
    where: { id: logId },
    data: {
      isReverted: true,
      revertedAt: new Date(),
    },
  });

  return { success: true, productId: log.productId };
}

/**
 * Revert all optimizations from a specific job
 */
export async function revertJob(jobId: string, shopDomain: string) {
  const logs = await prisma.optimizationLog.findMany({
    where: {
      jobId,
      shopDomain,
      isReverted: false,
    },
  });

  if (logs.length === 0) {
    throw new Error("No optimizations found to revert");
  }

  const session = await prisma.session.findFirst({
    where: { shop: shopDomain },
  });

  if (!session?.accessToken) {
    throw new Error("No valid session found");
  }

  let revertedCount = 0;
  const errors: string[] = [];

  for (const log of logs) {
    try {
      // TODO: Call Shopify API to revert
      // await updateShopifyProduct(shopDomain, session.accessToken, log.productId, log.oldValue);

      await prisma.optimizationLog.update({
        where: { id: log.id },
        data: {
          isReverted: true,
          revertedAt: new Date(),
        },
      });

      revertedCount++;
    } catch (error) {
      errors.push(`Failed to revert ${log.productId}: ${error}`);
    }
  }

  return {
    success: errors.length === 0,
    reverted: revertedCount,
    total: logs.length,
    errors,
  };
}

/**
 * Get optimization history for a shop
 */
export async function getOptimizationHistory(
  shopDomain: string,
  options: {
    page?: number;
    limit?: number;
    jobId?: string;
    showReverted?: boolean;
  } = {}
) {
  const { page = 1, limit = 20, jobId, showReverted = true } = options;
  const skip = (page - 1) * limit;

  const where: any = { shopDomain };

  if (jobId) {
    where.jobId = jobId;
  }

  if (!showReverted) {
    where.isReverted = false;
  }

  const [logs, total] = await Promise.all([
    prisma.optimizationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        job: {
          select: {
            type: true,
            status: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.optimizationLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
