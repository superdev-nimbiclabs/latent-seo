import { prisma } from "../db.server";
import { shopifyGraphQL } from "./shopify-api.server";

const UPDATE_PRODUCT_SEO_MUTATION = `
  mutation UpdateProductSEO($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface ProductUpdateResponse {
  productUpdate: {
    product: {
      id: string;
      seo: {
        title: string | null;
        description: string | null;
      };
    } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

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

  // Build the SEO update based on the field type
  const seoInput: { title?: string; description?: string } = {};

  if (log.field === "meta_title") {
    // Restore old title (or empty string if it was originally empty)
    seoInput.title = log.oldValue || "";
  } else if (log.field === "meta_description") {
    // Restore old description (or empty string if it was originally empty)
    seoInput.description = log.oldValue || "";
  } else {
    throw new Error(`Unsupported field type: ${log.field}`);
  }

  // We need to preserve the other SEO field to prevent it from being cleared
  // First, fetch the current product SEO data
  const GET_PRODUCT_SEO = `
    query GetProductSEO($id: ID!) {
      product(id: $id) {
        id
        seo {
          title
          description
        }
      }
    }
  `;

  interface ProductSeoResponse {
    product: {
      id: string;
      seo: {
        title: string | null;
        description: string | null;
      };
    } | null;
  }

  const currentProduct = await shopifyGraphQL<ProductSeoResponse>(
    shopDomain,
    session.accessToken,
    GET_PRODUCT_SEO,
    { id: log.productId }
  );

  if (!currentProduct.product) {
    throw new Error(`Product ${log.productId} not found`);
  }

  // Build complete SEO input preserving the field we're not reverting
  const completeInput: { title?: string; description?: string } = {};

  if (log.field === "meta_title") {
    completeInput.title = log.oldValue || "";
    // Preserve existing description
    if (currentProduct.product.seo.description) {
      completeInput.description = currentProduct.product.seo.description;
    }
  } else if (log.field === "meta_description") {
    completeInput.description = log.oldValue || "";
    // Preserve existing title
    if (currentProduct.product.seo.title) {
      completeInput.title = currentProduct.product.seo.title;
    }
  }

  console.log(`[Undo] Reverting ${log.field} for product ${log.productId}`);
  console.log(`[Undo] Old value: "${log.oldValue || "(empty)"}"`);
  console.log(`[Undo] Complete SEO input:`, completeInput);

  // Call Shopify API to revert the change
  const response = await shopifyGraphQL<ProductUpdateResponse>(
    shopDomain,
    session.accessToken,
    UPDATE_PRODUCT_SEO_MUTATION,
    {
      input: {
        id: log.productId,
        seo: completeInput,
      },
    }
  );

  if (response.productUpdate.userErrors.length > 0) {
    const errors = response.productUpdate.userErrors.map(e => e.message).join(", ");
    throw new Error(`Failed to revert: ${errors}`);
  }

  console.log(`[Undo] Successfully reverted ${log.field} for ${log.productId}`);

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

  let revertedCount = 0;
  const errors: string[] = [];

  for (const log of logs) {
    try {
      // Reuse the single revert function which handles Shopify API
      await revertOptimization(log.id, shopDomain);
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
