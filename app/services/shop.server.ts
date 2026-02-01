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
    customMetaTitlePrompt?: string | null;
    customMetaDescriptionPrompt?: string | null;
    customAltTextPrompt?: string | null;
    // Phase 6: Notification preferences
    notifyOnJobComplete?: boolean;
    notificationEmail?: string | null;
    // Phase 6: Custom API key
    customGeminiApiKey?: string | null;
    // Phase 6: Exclusion rules
    excludedTags?: string[];
    excludedCollections?: string[];
  }
) {
  return prisma.shop.update({
    where: { shopDomain },
    data: settings,
  });
}

export async function getShopExclusionRules(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: {
      excludedTags: true,
      excludedCollections: true,
    },
  });
  return {
    excludedTags: shop?.excludedTags || [],
    excludedCollections: shop?.excludedCollections || [],
  };
}

export async function getShopApiKey(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { customGeminiApiKey: true },
  });
  return shop?.customGeminiApiKey || null;
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
