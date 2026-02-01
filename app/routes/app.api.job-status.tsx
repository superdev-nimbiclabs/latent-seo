import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getJobStatus } from "../lib/queue.server";
import { prisma } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authenticate the request
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return json({ error: "Missing jobId parameter" }, { status: 400 });
  }

  try {
    // Get BullMQ job status
    const queueJob = await getJobStatus(jobId);

    // Also get the database job record for accurate counts
    // The worker updates Prisma with totalItems and processedItems
    const dbJob = await prisma.job.findFirst({
      where: {
        shopDomain: session.shop,
        status: { in: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!queueJob && !dbJob) {
      return json({ job: null });
    }

    // Merge data from both sources
    // BullMQ has state, Prisma has accurate counts
    const job = {
      id: queueJob?.id || dbJob?.id,
      state: queueJob?.state || (dbJob?.status === "COMPLETED" ? "completed" : dbJob?.status === "FAILED" ? "failed" : "active"),
      progress: queueJob?.progress || 0,
      data: {
        jobType: queueJob?.data?.jobType || dbJob?.type,
        shopDomain: queueJob?.data?.shopDomain || dbJob?.shopDomain,
        // Use Prisma values for accurate counts
        totalItems: dbJob?.totalItems || 0,
        processedItems: dbJob?.processedItems || 0,
      },
      failedReason: queueJob?.failedReason || dbJob?.errorMessage,
    };

    return json({ job });
  } catch (error) {
    console.error("[API] Failed to get job status:", error);
    return json(
      { error: "Failed to get job status" },
      { status: 500 }
    );
  }
};
