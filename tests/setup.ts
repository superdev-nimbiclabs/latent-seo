import { vi, beforeEach, afterEach } from "vitest";

// Mock environment variables
process.env.GEMINI_API_KEY = "test-gemini-api-key";
process.env.SHOPIFY_API_KEY = "test-shopify-api-key";
process.env.SHOPIFY_API_SECRET = "test-shopify-api-secret";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";

// Global mocks
vi.mock("../app/db.server", () => ({
  prisma: {
    shop: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    optimizationLog: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    usageRecord: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.resetAllMocks();
});
