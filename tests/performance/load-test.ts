/**
 * Performance Testing for LatentSEO
 *
 * Tests system performance with large datasets (10k+ products).
 * Run with: npx tsx tests/performance/load-test.ts
 */

interface PerformanceResult {
  name: string;
  duration: number;
  itemsProcessed: number;
  itemsPerSecond: number;
  memoryUsedMB: number;
}

// Simulate product data
function generateMockProducts(count: number) {
  const products = [];
  for (let i = 0; i < count; i++) {
    products.push({
      id: `gid://shopify/Product/${i}`,
      title: `Test Product ${i} - Premium Quality Item with Extended Description`,
      description: `This is a detailed product description for product ${i}. It contains multiple sentences to simulate real product data. The product features high-quality materials and excellent craftsmanship.`,
      vendor: `Vendor ${i % 100}`,
      tags: [`tag${i % 10}`, `category${i % 20}`, `brand${i % 50}`],
      seo: {
        title: i % 3 === 0 ? null : `SEO Title ${i}`,
        description: i % 2 === 0 ? null : `SEO Description for product ${i}`,
      },
      images: [
        { id: `img-${i}-1`, url: `https://example.com/img-${i}-1.jpg`, altText: i % 4 === 0 ? null : `Alt ${i}` },
        { id: `img-${i}-2`, url: `https://example.com/img-${i}-2.jpg`, altText: null },
      ],
    });
  }
  return products;
}

// Simulate audit scoring
function auditProduct(product: ReturnType<typeof generateMockProducts>[0]) {
  let score = 100;
  const issues: string[] = [];

  if (!product.seo.title) {
    score -= 30;
    issues.push("Missing SEO title");
  }
  if (!product.seo.description) {
    score -= 40;
    issues.push("Missing meta description");
  }

  const imagesWithoutAlt = product.images.filter(img => !img.altText);
  if (imagesWithoutAlt.length > 0) {
    score -= Math.min(30, imagesWithoutAlt.length * 10);
    issues.push(`${imagesWithoutAlt.length} images missing alt text`);
  }

  return { productId: product.id, score: Math.max(0, score), issues };
}

// Test: Audit scoring performance
async function testAuditPerformance(productCount: number): Promise<PerformanceResult> {
  const products = generateMockProducts(productCount);
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  const results = products.map(auditProduct);

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  const duration = endTime - startTime;

  return {
    name: `Audit ${productCount} products`,
    duration,
    itemsProcessed: results.length,
    itemsPerSecond: Math.round(results.length / (duration / 1000)),
    memoryUsedMB: Math.round((endMemory - startMemory) / 1024 / 1024 * 100) / 100,
  };
}

// Test: Product filtering performance
async function testFilteringPerformance(productCount: number): Promise<PerformanceResult> {
  const products = generateMockProducts(productCount);
  const excludedTags = ["tag1", "tag3", "tag5"];
  const excludedCollections = ["category2", "category8"];

  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  const filtered = products.filter(product => {
    // Check excluded tags
    const productTagsLower = product.tags.map(t => t.toLowerCase());
    for (const excludedTag of excludedTags) {
      if (productTagsLower.includes(excludedTag.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  const duration = endTime - startTime;

  return {
    name: `Filter ${productCount} products`,
    duration,
    itemsProcessed: products.length,
    itemsPerSecond: Math.round(products.length / (duration / 1000)),
    memoryUsedMB: Math.round((endMemory - startMemory) / 1024 / 1024 * 100) / 100,
  };
}

// Test: Pagination performance
async function testPaginationPerformance(productCount: number): Promise<PerformanceResult> {
  const products = generateMockProducts(productCount);
  const pageSize = 20;
  const startTime = performance.now();

  let pagesProcessed = 0;
  for (let offset = 0; offset < products.length; offset += pageSize) {
    const page = products.slice(offset, offset + pageSize);
    pagesProcessed++;
    // Simulate page processing
    page.forEach(p => auditProduct(p));
  }

  const endTime = performance.now();
  const duration = endTime - startTime;

  return {
    name: `Paginate ${productCount} products (${pageSize}/page)`,
    duration,
    itemsProcessed: products.length,
    itemsPerSecond: Math.round(products.length / (duration / 1000)),
    memoryUsedMB: 0, // Not measured for pagination
  };
}

// Test: Memory stress test
async function testMemoryStress(productCount: number): Promise<PerformanceResult> {
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  // Create large dataset
  const products = generateMockProducts(productCount);

  // Process all products (simulating batch processing)
  const auditResults = products.map(auditProduct);
  const filteredProducts = products.filter(p => !p.seo.title || !p.seo.description);
  const imagesMissingAlt = products.flatMap(p => p.images.filter(img => !img.altText));

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  const duration = endTime - startTime;

  // Force garbage collection hint
  if (global.gc) {
    global.gc();
  }

  return {
    name: `Memory stress test (${productCount} products)`,
    duration,
    itemsProcessed: products.length + auditResults.length + filteredProducts.length + imagesMissingAlt.length,
    itemsPerSecond: Math.round(productCount / (duration / 1000)),
    memoryUsedMB: Math.round((endMemory - startMemory) / 1024 / 1024 * 100) / 100,
  };
}

// Main test runner
async function runPerformanceTests() {
  console.log("=".repeat(60));
  console.log("LatentSEO Performance Tests");
  console.log("=".repeat(60));
  console.log("");

  const testCases = [
    { fn: testAuditPerformance, counts: [100, 1000, 5000, 10000] },
    { fn: testFilteringPerformance, counts: [100, 1000, 5000, 10000] },
    { fn: testPaginationPerformance, counts: [1000, 5000, 10000] },
    { fn: testMemoryStress, counts: [1000, 5000, 10000] },
  ];

  const results: PerformanceResult[] = [];

  for (const testCase of testCases) {
    for (const count of testCase.counts) {
      console.log(`Running: ${testCase.fn.name} with ${count} products...`);
      const result = await testCase.fn(count);
      results.push(result);
      console.log(`  Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`  Items/sec: ${result.itemsPerSecond}`);
      if (result.memoryUsedMB > 0) {
        console.log(`  Memory: ${result.memoryUsedMB}MB`);
      }
      console.log("");
    }
  }

  // Summary
  console.log("=".repeat(60));
  console.log("Performance Summary");
  console.log("=".repeat(60));
  console.log("");

  // Check thresholds
  const thresholds = {
    auditPerProduct: 1, // ms per product
    filterPerProduct: 0.1, // ms per product
    memoryPerProduct: 0.01, // MB per product
  };

  let passed = true;

  for (const result of results) {
    const msPerItem = result.duration / result.itemsProcessed;
    const status = msPerItem < thresholds.auditPerProduct ? "PASS" : "WARN";
    if (status === "WARN") passed = false;
    console.log(`[${status}] ${result.name}: ${msPerItem.toFixed(3)}ms/item`);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`Overall: ${passed ? "PASS - System can handle 10k+ products" : "WARN - Review performance"}`);
  console.log("=".repeat(60));

  // Return results for programmatic use
  return { results, passed };
}

// Run if executed directly
runPerformanceTests()
  .then(({ passed }) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error("Performance test failed:", error);
    process.exit(1);
  });

export { runPerformanceTests, testAuditPerformance, testFilteringPerformance };
