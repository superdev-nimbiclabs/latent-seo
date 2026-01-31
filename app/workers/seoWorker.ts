import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { generateMetaDescription } from "../services/gemini.server";
import { shopifyGraphQLWithRetry } from "../services/shopify-api.server";

// Initialize Prisma
const prisma = new PrismaClient();

// Redis connection for worker
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: redisUrl.startsWith("rediss://") ? {} : undefined,
  });
};

// Job data interface
interface SeoJobData {
  shopDomain: string;
  jobType: "META_DESCRIPTION" | "SCHEMA_INJECTION" | "ALT_TEXT";
  tone?: string;
  productIds?: string[];
}

// Process jobs
async function processJob(job: Job<SeoJobData>) {
  const { shopDomain, jobType, tone = "PROFESSIONAL" } = job.data;

  console.log(`[Worker] Starting job ${job.id} for ${shopDomain} (${jobType})`);

  try {
    // 1. Get or create the database job record
    let dbJob = await prisma.job.findFirst({
      where: {
        shopDomain,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!dbJob) {
      // Create shop if doesn't exist
      await prisma.shop.upsert({
        where: { shopDomain },
        create: { shopDomain },
        update: {},
      });

      dbJob = await prisma.job.create({
        data: {
          shopDomain,
          type: jobType,
          status: "PROCESSING",
        },
      });
    } else {
      // Update to processing
      await prisma.job.update({
        where: { id: dbJob.id },
        data: { status: "PROCESSING" },
      });
    }

    // 2. Get session for API access
    const session = await prisma.session.findFirst({
      where: { shop: shopDomain },
    });

    if (!session?.accessToken) {
      throw new Error(`No valid session found for ${shopDomain}`);
    }

    await job.updateProgress(10);

    // 3. Fetch products from Shopify that need SEO optimization
    const products = await fetchProductsNeedingOptimization(shopDomain, session.accessToken);

    const totalProducts = products.length;
    let processedCount = 0;

    // Update total items
    await prisma.job.update({
      where: { id: dbJob.id },
      data: { totalItems: totalProducts },
    });

    // 4. Process each product
    for (let i = 0; i < totalProducts; i++) {
      const product = products[i];

      // Generate meta description
      const newDescription = await generateMetaDescription({
        title: product.title,
        description: product.description,
        vendor: product.vendor,
        tags: product.tags,
      }, tone);

      if (newDescription) {
        // Update product in Shopify
        await updateProductMetaDescription(
          shopDomain,
          session.accessToken,
          product.id,
          newDescription
        );

        // Log the change for undo capability
        await prisma.optimizationLog.create({
          data: {
            shopDomain,
            jobId: dbJob.id,
            productId: product.id,
            productTitle: product.title,
            field: "meta_description",
            oldValue: product.seoDescription || "",
            newValue: newDescription,
          },
        });

        processedCount++;
      }

      // Update progress
      const progress = Math.round(((i + 1) / totalProducts) * 100);
      await job.updateProgress(progress);

      // Update database
      await prisma.job.update({
        where: { id: dbJob.id },
        data: { processedItems: processedCount },
      });

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 5. Mark job complete
    await prisma.job.update({
      where: { id: dbJob.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        processedItems: processedCount,
        totalItems: totalProducts,
      },
    });

    console.log(`[Worker] Job ${job.id} completed. Processed ${processedCount} products.`);

    return { success: true, processed: processedCount };

  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);

    // Update job status to failed
    await prisma.job.updateMany({
      where: {
        shopDomain,
        status: "PROCESSING",
      },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
}

// GraphQL query to fetch products for SEO optimization
const GET_PRODUCTS_QUERY = `
  query GetProductsForSEO($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          descriptionHtml
          vendor
          tags
          seo {
            description
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface ShopifyProduct {
  id: string;
  title: string;
  descriptionHtml: string;
  vendor: string;
  tags: string[];
  seo: {
    description: string | null;
  };
}

interface ProductsQueryResponse {
  products: {
    edges: Array<{ node: ShopifyProduct }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

// Fetch products that need SEO optimization (missing meta descriptions)
async function fetchProductsNeedingOptimization(
  shopDomain: string,
  accessToken: string
): Promise<Array<{
  id: string;
  title: string;
  description: string;
  vendor: string;
  tags: string[];
  seoDescription: string | null;
}>> {
  console.log(`[Worker] Fetching products for ${shopDomain}`);

  const allProducts: Array<{
    id: string;
    title: string;
    description: string;
    vendor: string;
    tags: string[];
    seoDescription: string | null;
  }> = [];

  let cursor: string | null = null;
  let hasNextPage = true;

  // Paginate through all products
  while (hasNextPage) {
    const response: ProductsQueryResponse = await shopifyGraphQLWithRetry<ProductsQueryResponse>(
      shopDomain,
      accessToken,
      GET_PRODUCTS_QUERY,
      cursor ? { cursor } : undefined
    );

    const products = response.products.edges.map((edge: { node: ShopifyProduct }) => edge.node);

    // Filter for products missing SEO description and map to our format
    for (const product of products) {
      if (!product.seo.description || product.seo.description.trim() === "") {
        allProducts.push({
          id: product.id,
          title: product.title,
          description: product.descriptionHtml,
          vendor: product.vendor,
          tags: product.tags,
          seoDescription: product.seo.description,
        });
      }
    }

    hasNextPage = response.products.pageInfo.hasNextPage;
    cursor = response.products.pageInfo.endCursor;

    // Small delay between pagination requests to respect rate limits
    if (hasNextPage) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  console.log(`[Worker] Found ${allProducts.length} products needing optimization`);
  return allProducts;
}

// GraphQL mutation to update product SEO
const UPDATE_PRODUCT_SEO_MUTATION = `
  mutation UpdateProductSEO($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        seo {
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
        description: string | null;
      };
    } | null;
    userErrors: Array<{
      field: string[];
      message: string;
    }>;
  };
}

// Update a product's meta description in Shopify
async function updateProductMetaDescription(
  shopDomain: string,
  accessToken: string,
  productId: string,
  metaDescription: string
): Promise<boolean> {
  console.log(`[Worker] Updating product ${productId} on ${shopDomain}`);

  try {
    const response = await shopifyGraphQLWithRetry<ProductUpdateResponse>(
      shopDomain,
      accessToken,
      UPDATE_PRODUCT_SEO_MUTATION,
      {
        input: {
          id: productId,
          seo: {
            description: metaDescription,
          },
        },
      }
    );

    // Check for user errors
    if (response.productUpdate.userErrors.length > 0) {
      const errors = response.productUpdate.userErrors
        .map((e) => `${e.field.join(".")}: ${e.message}`)
        .join("; ");
      console.error(`[Worker] Failed to update product ${productId}: ${errors}`);
      return false;
    }

    if (!response.productUpdate.product) {
      console.error(`[Worker] No product returned after update for ${productId}`);
      return false;
    }

    console.log(`[Worker] Successfully updated meta description for ${productId}`);
    return true;
  } catch (error) {
    console.error(`[Worker] Error updating product ${productId}:`, error);
    return false;
  }
}

// Create and start the worker
const worker = new Worker<SeoJobData>("seo-fixes", processJob, {
  connection: getRedisConnection(),
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
});

// Event handlers
worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

worker.on("progress", (job, progress) => {
  console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
});

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

console.log("[Worker] SEO Worker started and listening for jobs...");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] Received SIGTERM, closing worker...");
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

export default worker;
