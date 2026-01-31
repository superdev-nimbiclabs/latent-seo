import { prisma } from "../db.server";

export async function getOrCreateShop(shopDomain: string) {
  let shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        shopDomain,
        isActive: true,
      },
    });
  }

  return shop;
}

export async function updateShopSettings(
  shopDomain: string,
  settings: {
    aiTone?: string;
    autoPublish?: boolean;
  }
) {
  return prisma.shop.update({
    where: { shopDomain },
    data: settings,
  });
}

export async function getShopStats(shopDomain: string) {
  const [totalOptimized, totalJobs, recentLogs] = await Promise.all([
    prisma.optimizationLog.count({
      where: { shopDomain, isReverted: false },
    }),
    prisma.job.count({
      where: { shopDomain },
    }),
    prisma.optimizationLog.findMany({
      where: { shopDomain },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    totalOptimized,
    totalJobs,
    recentLogs,
  };
}
