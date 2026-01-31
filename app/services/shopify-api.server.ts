/**
 * Shopify GraphQL API helper for making authenticated requests
 */

const SHOPIFY_API_VERSION = "2025-01";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

interface ShopifyAPIError extends Error {
  status?: number;
  retryAfter?: number;
}

/**
 * Makes an authenticated GraphQL request to Shopify Admin API
 */
export async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const endpoint = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  // Handle rate limits
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("Retry-After") || "2", 10);
    const error = new Error(`Rate limited. Retry after ${retryAfter}s`) as ShopifyAPIError;
    error.status = 429;
    error.retryAfter = retryAfter;
    throw error;
  }

  // Handle auth errors
  if (response.status === 401 || response.status === 403) {
    const error = new Error(`Authentication failed for ${shopDomain}`) as ShopifyAPIError;
    error.status = response.status;
    throw error;
  }

  // Handle other HTTP errors
  if (!response.ok) {
    const error = new Error(`Shopify API error: ${response.status} ${response.statusText}`) as ShopifyAPIError;
    error.status = response.status;
    throw error;
  }

  const json: GraphQLResponse<T> = await response.json();

  // Handle GraphQL errors
  if (json.errors && json.errors.length > 0) {
    const errorMessages = json.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL errors: ${errorMessages}`);
  }

  if (!json.data) {
    throw new Error("No data returned from Shopify API");
  }

  return json.data;
}

/**
 * Retry wrapper for GraphQL calls with exponential backoff
 */
export async function shopifyGraphQLWithRetry<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await shopifyGraphQL<T>(shopDomain, accessToken, query, variables);
    } catch (error) {
      lastError = error as Error;
      const apiError = error as ShopifyAPIError;

      // Don't retry auth errors
      if (apiError.status === 401 || apiError.status === 403) {
        throw error;
      }

      // Handle rate limits with specific retry delay
      if (apiError.status === 429) {
        const delay = (apiError.retryAfter || 2) * 1000;
        console.log(`[Shopify] Rate limited, waiting ${delay}ms before retry...`);
        await sleep(delay);
        continue;
      }

      // Exponential backoff for other errors
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Shopify] Request failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
