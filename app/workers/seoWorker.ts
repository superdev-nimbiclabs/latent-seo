import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import {
  generateMetaDescription,
  generateMetaTitle,
  generateAltTextWithVision,
  generateAltTextFallback,
} from "../services/gemini.server";
import { shopifyGraphQLWithRetry } from "../services/shopify-api.server";
import { incrementUsage, canOptimize } from "../services/billing.server";
import { initSentry, captureError, setUserContext, addBreadcrumb } from "../lib/sentry.server";

// Initialize Sentry for worker process
initSentry();

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
  console.log(`[Worker] ========== JOB RECEIVED ==========`);
  console.log(`[Worker] Job ID: ${job.id}`);
  console.log(`[Worker] Job data:`, JSON.stringify(job.data, null, 2));

  const { shopDomain, jobType, tone = "PROFESSIONAL" } = job.data;

  console.log(`[Worker] Starting job ${job.id} for ${shopDomain} (${jobType})`);

  // Set Sentry context for this job
  setUserContext(shopDomain);
  addBreadcrumb(`Starting ${jobType} job`, "worker", { jobId: job.id });

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

    // 3. Get shop settings for custom prompts and exclusion rules
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
    });

    const customPrompts = {
      metaTitle: shop?.customMetaTitlePrompt || null,
      metaDescription: shop?.customMetaDescriptionPrompt || null,
      altText: shop?.customAltTextPrompt || null,
    };

    const exclusionRules = {
      excludedTags: shop?.excludedTags || [],
      excludedCollections: shop?.excludedCollections || [],
    };

    console.log(`[Worker] Exclusion rules - Tags: ${exclusionRules.excludedTags.join(", ") || "none"}, Collections: ${exclusionRules.excludedCollections.join(", ") || "none"}`);

    await job.updateProgress(10);

    // 4. Check plan limits before processing
    const usageCheck = await canOptimize(shopDomain);
    if (!usageCheck.allowed) {
      console.log(`[Worker] Shop ${shopDomain} has reached plan limit: ${usageCheck.reason}`);
      throw new Error(usageCheck.reason || "Plan limit reached");
    }

    // 5. Process based on job type
    let processedCount = 0;
    let totalItems = 0;

    if (jobType === "META_DESCRIPTION") {
      const result = await processMetaDescriptions(
        shopDomain,
        session.accessToken,
        dbJob.id,
        tone,
        customPrompts,
        exclusionRules,
        job
      );
      processedCount = result.processedCount;
      totalItems = result.totalItems;
    } else if (jobType === "ALT_TEXT") {
      const result = await processAltText(
        shopDomain,
        session.accessToken,
        dbJob.id,
        tone,
        customPrompts.altText,
        exclusionRules,
        job
      );
      processedCount = result.processedCount;
      totalItems = result.totalItems;
    } else {
      console.log(`[Worker] Unknown job type: ${jobType}`);
    }

    // 4. Mark job complete
    await prisma.job.update({
      where: { id: dbJob.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        processedItems: processedCount,
        totalItems: totalItems,
      },
    });

    console.log(`[Worker] Job ${job.id} completed. Processed ${processedCount} items.`);

    return { success: true, processed: processedCount };

  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);

    // Capture error in Sentry
    if (error instanceof Error) {
      captureError(error, {
        shopDomain,
        jobId: String(job.id),
        action: `process_${jobType}`,
      });
    }

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

// ============================================
// SEO OPTIMIZATION PROCESSING (Title + Description)
// ============================================

async function processMetaDescriptions(
  shopDomain: string,
  accessToken: string,
  dbJobId: string,
  tone: string,
  customPrompts: { metaTitle: string | null; metaDescription: string | null; altText: string | null },
  exclusionRules: { excludedTags: string[]; excludedCollections: string[] },
  job: Job<SeoJobData>
): Promise<{ processedCount: number; totalItems: number }> {
  const allProducts = await fetchProductsNeedingSeo(shopDomain, accessToken);

  // Filter out excluded products
  const products = allProducts.filter(product => {
    // Check excluded tags
    if (exclusionRules.excludedTags.length > 0) {
      const productTagsLower = product.tags.map(t => t.toLowerCase());
      for (const excludedTag of exclusionRules.excludedTags) {
        if (productTagsLower.includes(excludedTag.toLowerCase())) {
          console.log(`[Worker] Skipping product "${product.title}" - has excluded tag: ${excludedTag}`);
          return false;
        }
      }
    }

    // Check excluded collections
    if (exclusionRules.excludedCollections.length > 0 && product.collections) {
      for (const excludedCollection of exclusionRules.excludedCollections) {
        if (product.collections.some(c => c.toLowerCase() === excludedCollection.toLowerCase())) {
          console.log(`[Worker] Skipping product "${product.title}" - in excluded collection: ${excludedCollection}`);
          return false;
        }
      }
    }

    return true;
  });

  console.log(`[Worker] ${allProducts.length} products need SEO, ${allProducts.length - products.length} excluded by rules`);
  const totalProducts = products.length;
  let processedCount = 0;

  // Update total items
  await prisma.job.update({
    where: { id: dbJobId },
    data: { totalItems: totalProducts },
  });

  for (let i = 0; i < totalProducts; i++) {
    const product = products[i];
    const productInput = {
      title: product.title,
      description: product.description,
      vendor: product.vendor,
      tags: product.tags,
    };

    const seoUpdate: { title?: string; description?: string } = {};
    let updated = false;

    // Generate title if needed
    if (product.needsTitle) {
      const newTitle = await generateMetaTitle(productInput, tone, customPrompts.metaTitle);
      if (newTitle) {
        seoUpdate.title = newTitle;

        // Log title change for undo
        await prisma.optimizationLog.create({
          data: {
            shopDomain,
            jobId: dbJobId,
            productId: product.id,
            productTitle: product.title,
            field: "meta_title",
            oldValue: product.seoTitle || "",
            newValue: newTitle,
          },
        });
      }
    }

    // Generate description if needed
    if (product.needsDescription) {
      const newDescription = await generateMetaDescription(productInput, tone, customPrompts.metaDescription);
      if (newDescription) {
        seoUpdate.description = newDescription;

        // Log description change for undo
        await prisma.optimizationLog.create({
          data: {
            shopDomain,
            jobId: dbJobId,
            productId: product.id,
            productTitle: product.title,
            field: "meta_description",
            oldValue: product.seoDescription || "",
            newValue: newDescription,
          },
        });
      }
    }

    // Update product if we have changes
    // IMPORTANT: Always include BOTH title and description to prevent Shopify from clearing them
    if (seoUpdate.title || seoUpdate.description) {
      // Build the full SEO update with existing values preserved
      const fullSeoUpdate: { title?: string; description?: string } = {};

      // Use new title if generated, otherwise keep existing (if it exists and is not empty)
      if (seoUpdate.title) {
        fullSeoUpdate.title = seoUpdate.title;
      } else if (product.seoTitle && product.seoTitle.trim() !== "") {
        fullSeoUpdate.title = product.seoTitle;
      }

      // Use new description if generated, otherwise keep existing (if it exists and is not empty)
      if (seoUpdate.description) {
        fullSeoUpdate.description = seoUpdate.description;
      } else if (product.seoDescription && product.seoDescription.trim() !== "") {
        fullSeoUpdate.description = product.seoDescription;
      }

      console.log(`[Worker] Full SEO update for ${product.title}:`, JSON.stringify(fullSeoUpdate));

      const success = await updateProductSeo(
        shopDomain,
        accessToken,
        product.id,
        fullSeoUpdate
      );

      if (success) {
        updated = true;
        processedCount++;

        // Track usage for billing
        await incrementUsage(shopDomain, "productsOptimized", 1);
        if (seoUpdate.title) {
          await incrementUsage(shopDomain, "metaTitlesGenerated", 1);
        }
        if (seoUpdate.description) {
          await incrementUsage(shopDomain, "metaDescriptionsGenerated", 1);
        }
      }
    }

    // Update progress
    const progress = Math.round(((i + 1) / totalProducts) * 100);
    await job.updateProgress(progress);

    // Update database
    await prisma.job.update({
      where: { id: dbJobId },
      data: { processedItems: processedCount },
    });

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { processedCount, totalItems: totalProducts };
}

// GraphQL query to fetch products for SEO optimization (includes collections for exclusion)
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
          collections(first: 10) {
            edges {
              node {
                handle
              }
            }
          }
          seo {
            title
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
  collections: {
    edges: Array<{
      node: {
        handle: string;
      };
    }>;
  };
  seo: {
    title: string | null;
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

async function fetchProductsNeedingSeo(
  shopDomain: string,
  accessToken: string
): Promise<Array<{
  id: string;
  title: string;
  description: string;
  vendor: string;
  tags: string[];
  collections: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  needsTitle: boolean;
  needsDescription: boolean;
}>> {
  console.log(`[Worker] Fetching products needing SEO optimization for ${shopDomain}`);

  const allProducts: Array<{
    id: string;
    title: string;
    description: string;
    vendor: string;
    tags: string[];
    collections: string[];
    seoTitle: string | null;
    seoDescription: string | null;
    needsTitle: boolean;
    needsDescription: boolean;
  }> = [];

  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: ProductsQueryResponse = await shopifyGraphQLWithRetry<ProductsQueryResponse>(
      shopDomain,
      accessToken,
      GET_PRODUCTS_QUERY,
      cursor ? { cursor } : undefined
    );

    const products = response.products.edges.map((edge) => edge.node);

    for (const product of products) {
      const needsTitle = !product.seo.title || product.seo.title.trim() === "";
      const needsDescription = !product.seo.description || product.seo.description.trim() === "";

      // Include if missing either title or description
      if (needsTitle || needsDescription) {
        // Extract collection handles
        const collections = product.collections?.edges?.map(e => e.node.handle) || [];

        allProducts.push({
          id: product.id,
          title: product.title,
          description: product.descriptionHtml,
          vendor: product.vendor,
          tags: product.tags,
          collections,
          seoTitle: product.seo.title,
          seoDescription: product.seo.description,
          needsTitle,
          needsDescription,
        });
      }
    }

    hasNextPage = response.products.pageInfo.hasNextPage;
    cursor = response.products.pageInfo.endCursor;

    if (hasNextPage) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  console.log(`[Worker] Found ${allProducts.length} products needing SEO optimization`);
  return allProducts;
}

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
    userErrors: Array<{
      field: string[];
      message: string;
    }>;
  };
}

async function updateProductSeo(
  shopDomain: string,
  accessToken: string,
  productId: string,
  seo: { title?: string; description?: string }
): Promise<boolean> {
  console.log(`[Worker] ========== UPDATING PRODUCT SEO ==========`);
  console.log(`[Worker] Product ID: ${productId}`);
  console.log(`[Worker] SEO Data:`, JSON.stringify(seo, null, 2));
  console.log(`[Worker] Has title: ${!!seo.title}`);
  console.log(`[Worker] Has description: ${!!seo.description}`);

  try {
    const response = await shopifyGraphQLWithRetry<ProductUpdateResponse>(
      shopDomain,
      accessToken,
      UPDATE_PRODUCT_SEO_MUTATION,
      {
        input: {
          id: productId,
          seo,
        },
      }
    );

    console.log(`[Worker] Shopify response:`, JSON.stringify(response, null, 2));

    if (response.productUpdate.userErrors.length > 0) {
      const errors = response.productUpdate.userErrors
        .map((e) => `${e.field.join(".")}: ${e.message}`)
        .join("; ");
      console.error(`[Worker] Failed to update product ${productId}: ${errors}`);
      return false;
    }

    console.log(`[Worker] Successfully updated SEO for ${productId}`);
    console.log(`[Worker] New SEO title: ${response.productUpdate.product?.seo?.title}`);
    console.log(`[Worker] New SEO desc: ${response.productUpdate.product?.seo?.description?.slice(0, 50)}...`);
    return true;
  } catch (error) {
    console.error(`[Worker] Error updating product ${productId}:`, error);
    return false;
  }
}

// ============================================
// ALT TEXT PROCESSING
// ============================================

async function processAltText(
  shopDomain: string,
  accessToken: string,
  dbJobId: string,
  tone: string,
  customPrompt: string | null,
  exclusionRules: { excludedTags: string[]; excludedCollections: string[] },
  job: Job<SeoJobData>
): Promise<{ processedCount: number; totalItems: number }> {
  const allImages = await fetchImagesMissingAltText(shopDomain, accessToken, exclusionRules);
  const totalImages = allImages.length;
  let processedCount = 0;

  console.log(`[Worker] Processing ${totalImages} images missing alt text (after exclusions)`);
  const images = allImages;

  // Update total items
  await prisma.job.update({
    where: { id: dbJobId },
    data: { totalItems: totalImages },
  });

  for (let i = 0; i < totalImages; i++) {
    const image = images[i];

    // Generate alt text using vision AI (with fallback to text-only)
    let altText: string | null = null;

    try {
      // Try vision-based generation first
      altText = await generateAltTextWithVision(
        image.imageUrl,
        image.productTitle,
        tone,
        customPrompt
      );
    } catch (error) {
      console.log(`[Worker] Vision generation failed for ${image.imageId}, trying fallback`);
    }

    // Fallback to text-only if vision fails
    if (!altText) {
      altText = await generateAltTextFallback(
        image.productTitle,
        "", // No description available in this context
        tone,
        customPrompt
      );
    }

    if (altText) {
      // Update image in Shopify
      const success = await updateImageAltText(
        shopDomain,
        accessToken,
        image.productId,
        image.imageId,
        altText
      );

      if (success) {
        // Log the change for undo capability
        await prisma.optimizationLog.create({
          data: {
            shopDomain,
            jobId: dbJobId,
            productId: image.productId,
            productTitle: image.productTitle,
            field: "alt_text",
            oldValue: image.currentAltText || "",
            newValue: altText,
          },
        });

        processedCount++;

        // Track usage for billing
        await incrementUsage(shopDomain, "altTextsGenerated", 1);
      }
    }

    // Update progress
    const progress = Math.round(((i + 1) / totalImages) * 100);
    await job.updateProgress(progress);

    // Update database
    await prisma.job.update({
      where: { id: dbJobId },
      data: { processedItems: processedCount },
    });

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { processedCount, totalItems: totalImages };
}

// GraphQL query to fetch products with images (includes tags/collections for exclusion)
const GET_PRODUCTS_WITH_IMAGES_QUERY = `
  query GetProductsWithImages($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          tags
          collections(first: 10) {
            edges {
              node {
                handle
              }
            }
          }
          featuredImage {
            id
            url
            altText
          }
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
              }
            }
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

interface ProductWithImages {
  id: string;
  title: string;
  tags: string[];
  collections: {
    edges: Array<{
      node: {
        handle: string;
      };
    }>;
  };
  featuredImage: {
    id: string;
    url: string;
    altText: string | null;
  } | null;
  images: {
    edges: Array<{
      node: {
        id: string;
        url: string;
        altText: string | null;
      };
    }>;
  };
}

interface ProductsWithImagesResponse {
  products: {
    edges: Array<{ node: ProductWithImages }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

interface ImageNeedingAltText {
  productId: string;
  productTitle: string;
  imageId: string;
  imageUrl: string;
  currentAltText: string | null;
}

async function fetchImagesMissingAltText(
  shopDomain: string,
  accessToken: string,
  exclusionRules: { excludedTags: string[]; excludedCollections: string[] }
): Promise<ImageNeedingAltText[]> {
  console.log(`[Worker] Fetching images missing alt text for ${shopDomain}`);

  const allImages: ImageNeedingAltText[] = [];
  let excludedCount = 0;

  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: ProductsWithImagesResponse = await shopifyGraphQLWithRetry<ProductsWithImagesResponse>(
      shopDomain,
      accessToken,
      GET_PRODUCTS_WITH_IMAGES_QUERY,
      cursor ? { cursor } : undefined
    );

    const products = response.products.edges.map((edge) => edge.node);

    for (const product of products) {
      // Check exclusion rules
      let isExcluded = false;

      // Check excluded tags
      if (exclusionRules.excludedTags.length > 0) {
        const productTagsLower = product.tags.map(t => t.toLowerCase());
        for (const excludedTag of exclusionRules.excludedTags) {
          if (productTagsLower.includes(excludedTag.toLowerCase())) {
            console.log(`[Worker] Skipping product "${product.title}" for alt text - has excluded tag: ${excludedTag}`);
            isExcluded = true;
            break;
          }
        }
      }

      // Check excluded collections
      if (!isExcluded && exclusionRules.excludedCollections.length > 0) {
        const collectionHandles = product.collections?.edges?.map(e => e.node.handle.toLowerCase()) || [];
        for (const excludedCollection of exclusionRules.excludedCollections) {
          if (collectionHandles.includes(excludedCollection.toLowerCase())) {
            console.log(`[Worker] Skipping product "${product.title}" for alt text - in excluded collection: ${excludedCollection}`);
            isExcluded = true;
            break;
          }
        }
      }

      if (isExcluded) {
        excludedCount++;
        continue;
      }

      // Check featured image
      if (product.featuredImage && (!product.featuredImage.altText || product.featuredImage.altText.trim() === "")) {
        allImages.push({
          productId: product.id,
          productTitle: product.title,
          imageId: product.featuredImage.id,
          imageUrl: product.featuredImage.url,
          currentAltText: product.featuredImage.altText,
        });
      }

      // Check other images
      for (const imageEdge of product.images.edges) {
        const image = imageEdge.node;
        // Skip if it's the same as featured image (already added)
        if (product.featuredImage && image.id === product.featuredImage.id) continue;

        if (!image.altText || image.altText.trim() === "") {
          allImages.push({
            productId: product.id,
            productTitle: product.title,
            imageId: image.id,
            imageUrl: image.url,
            currentAltText: image.altText,
          });
        }
      }
    }

    hasNextPage = response.products.pageInfo.hasNextPage;
    cursor = response.products.pageInfo.endCursor;

    if (hasNextPage) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  console.log(`[Worker] Found ${allImages.length} images missing alt text (${excludedCount} products excluded)`);
  return allImages;
}

// GraphQL mutation to update image alt text
const UPDATE_IMAGE_ALT_MUTATION = `
  mutation UpdateProductMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage {
          id
          alt
        }
      }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

interface UpdateImageResponse {
  productUpdateMedia: {
    media: Array<{
      id: string;
      alt: string | null;
    }>;
    mediaUserErrors: Array<{
      field: string[];
      message: string;
    }>;
  };
}

async function updateImageAltText(
  shopDomain: string,
  accessToken: string,
  productId: string,
  imageId: string,
  altText: string
): Promise<boolean> {
  console.log(`[Worker] Updating alt text for image ${imageId}`);

  try {
    const response = await shopifyGraphQLWithRetry<UpdateImageResponse>(
      shopDomain,
      accessToken,
      UPDATE_IMAGE_ALT_MUTATION,
      {
        productId,
        media: [{
          id: imageId,
          alt: altText,
        }],
      }
    );

    if (response.productUpdateMedia.mediaUserErrors.length > 0) {
      const errors = response.productUpdateMedia.mediaUserErrors
        .map((e) => `${e.field.join(".")}: ${e.message}`)
        .join("; ");
      console.error(`[Worker] Failed to update image ${imageId}: ${errors}`);
      return false;
    }

    console.log(`[Worker] Successfully updated alt text for image ${imageId}`);
    return true;
  } catch (error) {
    console.error(`[Worker] Error updating image ${imageId}:`, error);
    return false;
  }
}

// ============================================
// WORKER SETUP
// ============================================

const worker = new Worker<SeoJobData>("seo-fixes", processJob, {
  connection: getRedisConnection(),
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  },
});

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  // Capture worker-level failures in Sentry
  captureError(err, {
    jobId: job?.id ? String(job.id) : undefined,
    action: "worker_job_failed",
  });
});

worker.on("progress", (job, progress) => {
  console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
});

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
  // Capture worker-level errors in Sentry
  captureError(err, { action: "worker_error" });
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
