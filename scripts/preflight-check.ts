#!/usr/bin/env npx tsx

/**
 * Pre-Launch Verification Script
 *
 * Run before deploying to production to verify all requirements are met.
 * Usage: npx tsx scripts/preflight-check.ts
 */

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, passMsg: string, failMsg: string, isWarning = false) {
  results.push({
    name,
    status: condition ? "pass" : isWarning ? "warn" : "fail",
    message: condition ? passMsg : failMsg,
  });
}

async function runChecks() {
  console.log("\n🚀 LatentSEO Pre-Launch Verification\n");
  console.log("=".repeat(50));

  // 1. Environment Variables
  console.log("\n📋 Checking Environment Variables...\n");

  const requiredEnvVars = [
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "DATABASE_URL",
    "REDIS_URL",
    "GEMINI_API_KEY",
  ];

  const optionalEnvVars = [
    "SENTRY_DSN",
    "NODE_ENV",
  ];

  for (const envVar of requiredEnvVars) {
    check(
      `ENV: ${envVar}`,
      !!process.env[envVar],
      "Set",
      "MISSING - Required for production"
    );
  }

  for (const envVar of optionalEnvVars) {
    check(
      `ENV: ${envVar}`,
      !!process.env[envVar],
      "Set",
      "Not set (optional)",
      true
    );
  }

  // 2. Required Files
  console.log("\n📁 Checking Required Files...\n");

  const fs = await import("fs");
  const path = await import("path");
  const rootDir = process.cwd();

  const requiredFiles = [
    "package.json",
    "prisma/schema.prisma",
    "Dockerfile",
    "fly.toml",
    "shopify.app.toml",
    "app/routes/webhooks.tsx",
    "app/routes/privacy.tsx",
    "app/routes/terms.tsx",
    ".env.example",
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(rootDir, file);
    check(
      `FILE: ${file}`,
      fs.existsSync(filePath),
      "Found",
      "MISSING"
    );
  }

  // 3. Package.json Scripts
  console.log("\n📦 Checking Package Scripts...\n");

  try {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    const requiredScripts = ["build", "start", "setup", "test"];

    for (const script of requiredScripts) {
      check(
        `SCRIPT: ${script}`,
        !!packageJson.scripts?.[script],
        "Defined",
        "MISSING"
      );
    }
  } catch {
    check("Package.json", false, "", "Could not read package.json");
  }

  // 4. Shopify App Configuration
  console.log("\n🛒 Checking Shopify Configuration...\n");

  try {
    const toml = fs.readFileSync("shopify.app.toml", "utf-8");

    check(
      "Shopify: client_id",
      toml.includes("client_id"),
      "Configured",
      "MISSING - Run shopify app config"
    );

    check(
      "Shopify: application_url",
      toml.includes("application_url"),
      "Configured",
      "MISSING"
    );

    check(
      "Shopify: GDPR webhooks",
      toml.includes("customers/data_request") &&
      toml.includes("customers/redact") &&
      toml.includes("shop/redact"),
      "All 3 mandatory webhooks configured",
      "MISSING GDPR webhooks"
    );

    check(
      "Shopify: Access scopes",
      toml.includes("read_products") && toml.includes("write_products"),
      "Configured",
      "MISSING required scopes"
    );
  } catch {
    check("shopify.app.toml", false, "", "Could not read file");
  }

  // 5. Database Schema
  console.log("\n🗄️ Checking Database Schema...\n");

  try {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");

    const requiredModels = ["Session", "Shop", "Job", "OptimizationLog", "UsageRecord"];

    for (const model of requiredModels) {
      check(
        `MODEL: ${model}`,
        schema.includes(`model ${model}`),
        "Defined",
        "MISSING"
      );
    }
  } catch {
    check("Prisma schema", false, "", "Could not read file");
  }

  // 6. Docker Configuration
  console.log("\n🐳 Checking Docker Configuration...\n");

  try {
    const dockerfile = fs.readFileSync("Dockerfile", "utf-8");

    check(
      "Docker: Node version",
      dockerfile.includes("node:20") || dockerfile.includes("node:22"),
      "Node 20+ configured",
      "Update to Node 20+",
      true
    );

    check(
      "Docker: Multi-stage build",
      dockerfile.includes("FROM") && dockerfile.split("FROM").length > 2,
      "Multi-stage build configured",
      "Consider multi-stage build",
      true
    );
  } catch {
    check("Dockerfile", false, "", "Could not read file");
  }

  // 7. Fly.io Configuration
  console.log("\n✈️ Checking Fly.io Configuration...\n");

  try {
    const flyToml = fs.readFileSync("fly.toml", "utf-8");

    check(
      "Fly: App name",
      flyToml.includes("app ="),
      "Configured",
      "MISSING"
    );

    check(
      "Fly: Health check",
      flyToml.includes("[http_service.checks]") || flyToml.includes("[[http_service.checks]]"),
      "Configured",
      "Add health checks",
      true
    );

    check(
      "Fly: Worker process",
      flyToml.includes("[processes]") && flyToml.includes("worker"),
      "Worker process configured",
      "Add worker process for background jobs"
    );
  } catch {
    check("fly.toml", false, "", "Could not read file");
  }

  // Print Results
  console.log("\n" + "=".repeat(50));
  console.log("\n📊 Results Summary\n");

  const passed = results.filter((r) => r.status === "pass").length;
  const warnings = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  for (const result of results) {
    const icon = result.status === "pass" ? "✅" : result.status === "warn" ? "⚠️" : "❌";
    console.log(`${icon} ${result.name}: ${result.message}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Failed: ${failed}`);
  console.log("");

  if (failed > 0) {
    console.log("🚨 Fix the failed checks before deploying to production.\n");
    process.exit(1);
  } else if (warnings > 0) {
    console.log("⚠️  Review warnings - they may affect production.\n");
    process.exit(0);
  } else {
    console.log("🎉 All checks passed! Ready for deployment.\n");
    process.exit(0);
  }
}

// Pre-launch checklist printout
function printChecklist() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              LATENTSEO PRE-LAUNCH CHECKLIST                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  BEFORE DEPLOYING:                                           ║
║  □ Run preflight check: npx tsx scripts/preflight-check.ts   ║
║  □ Run all tests: npm run test:all                           ║
║  □ Build succeeds: npm run build                             ║
║  □ TypeScript clean: npm run typecheck                       ║
║                                                              ║
║  ENVIRONMENT:                                                ║
║  □ Set all production environment variables                  ║
║  □ Configure production DATABASE_URL                         ║
║  □ Configure production REDIS_URL                            ║
║  □ Verify GEMINI_API_KEY has production quota                ║
║                                                              ║
║  DATABASE:                                                   ║
║  □ Run migrations: npx prisma migrate deploy                 ║
║  □ Verify database connectivity                              ║
║                                                              ║
║  SHOPIFY:                                                    ║
║  □ Deploy app config: npm run deploy                         ║
║  □ Verify webhooks registered in Partner Dashboard           ║
║  □ Test OAuth flow on development store                      ║
║                                                              ║
║  APP STORE (if publishing):                                  ║
║  □ App name and description                                  ║
║  □ 4-6 screenshots (1600x900)                                ║
║  □ App icon (256x256)                                        ║
║  □ Demo video URL                                            ║
║  □ Privacy policy URL deployed                               ║
║  □ Support email configured                                  ║
║                                                              ║
║  POST-DEPLOYMENT:                                            ║
║  □ Verify health check endpoint responds                     ║
║  □ Test app installation on dev store                        ║
║  □ Run one optimization job                                  ║
║  □ Verify worker processes jobs                              ║
║  □ Check Sentry for errors (if configured)                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

// Main
printChecklist();
runChecks();
