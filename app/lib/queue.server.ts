import { Queue } from "bullmq";
import IORedis from "ioredis";

// Parse Redis URL and create connection
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    tls: redisUrl.startsWith("rediss://") ? {} : undefined,
  });
};

// Singleton connection for the queue
let connection: IORedis | null = null;

const getConnection = () => {
  if (!connection) {
    connection = getRedisConnection();
  }
  return connection;
};

// Create the SEO fixes queue
export const seoQueue = new Queue("seo-fixes", {
  connection: getConnection(),
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

// Job data interface
export interface SeoJobData {
  shopDomain: string;
  jobType: "META_DESCRIPTION" | "SCHEMA_INJECTION" | "ALT_TEXT";
  tone?: string;
  productIds?: string[]; // Optional: specific products to process
}

/**
 * Add a new SEO fix job to the queue
 */
export async function addSeoFixJob(data: SeoJobData): Promise<string> {
  const job = await seoQueue.add("fix-job", data, {
    jobId: `${data.shopDomain}-${data.jobType}-${Date.now()}`,
  });

  console.log(`[Queue] Added job ${job.id} for ${data.shopDomain}`);
  return job.id!;
}

/**
 * Get job status by ID
 */
export async function getJobStatus(jobId: string) {
  const job = await seoQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    failedReason: job.failedReason,
  };
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    seoQueue.getWaitingCount(),
    seoQueue.getActiveCount(),
    seoQueue.getCompletedCount(),
    seoQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}
