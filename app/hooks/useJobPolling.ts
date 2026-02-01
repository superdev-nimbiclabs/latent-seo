import { useEffect, useState, useCallback } from "react";
import type { ActiveJob } from "../types/seo";

interface UseJobPollingOptions {
  jobId: string | null;
  interval?: number;
  onComplete?: (job: ActiveJob) => void;
  onError?: (error: Error) => void;
}

interface UseJobPollingResult {
  job: ActiveJob | null;
  isPolling: boolean;
  error: Error | null;
  stopPolling: () => void;
}

export function useJobPolling({
  jobId,
  interval = 2000,
  onComplete,
  onError,
}: UseJobPollingOptions): UseJobPollingResult {
  const [job, setJob] = useState<ActiveJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [shouldPoll, setShouldPoll] = useState(true);

  const stopPolling = useCallback(() => {
    setShouldPoll(false);
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!jobId || !shouldPoll) {
      setIsPolling(false);
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted || !shouldPoll) return;

      setIsPolling(true);

      try {
        const response = await fetch(`/app/api/job-status?jobId=${encodeURIComponent(jobId)}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch job status: ${response.status}`);
        }

        const data = await response.json();

        if (!isMounted) return;

        if (data.job) {
          const activeJob: ActiveJob = {
            id: data.job.id,
            type: data.job.data?.jobType || "META_DESCRIPTION",
            // Use processedItems from Prisma for accurate count
            processed: data.job.data?.processedItems || 0,
            // Use totalItems from Prisma for accurate count
            total: data.job.data?.totalItems || 0,
            status:
              data.job.state === "completed"
                ? "COMPLETED"
                : data.job.state === "failed"
                ? "FAILED"
                : data.job.state === "active"
                ? "PROCESSING"
                : "PENDING",
          };

          setJob(activeJob);
          setError(null);

          // Check if job is complete
          if (activeJob.status === "COMPLETED" || activeJob.status === "FAILED") {
            stopPolling();
            if (activeJob.status === "COMPLETED" && onComplete) {
              onComplete(activeJob);
            }
            return;
          }
        } else {
          // Job not found - might be complete and removed
          stopPolling();
        }

        // Schedule next poll
        if (isMounted && shouldPoll) {
          timeoutId = setTimeout(poll, interval);
        }
      } catch (err) {
        if (!isMounted) return;

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        if (onError) {
          onError(error);
        }

        // Continue polling even on error
        if (isMounted && shouldPoll) {
          timeoutId = setTimeout(poll, interval);
        }
      }
    };

    // Start polling immediately
    poll();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [jobId, interval, shouldPoll, onComplete, onError, stopPolling]);

  return { job, isPolling, error, stopPolling };
}
