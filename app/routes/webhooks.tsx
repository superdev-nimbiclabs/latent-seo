import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

/**
 * Shopify Webhook Handler
 *
 * Handles mandatory GDPR webhooks required for Shopify App Store:
 * - customers/data_request: Customer requests their data
 * - customers/redact: Customer requests data deletion
 * - shop/redact: Shop uninstalls app, delete all shop data
 *
 * Also handles app lifecycle webhooks:
 * - app/uninstalled: App was uninstalled from a shop
 */

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] Received ${topic} from ${shop}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      await handleAppUninstalled(shop);
      break;

    case "CUSTOMERS_DATA_REQUEST":
      await handleCustomersDataRequest(shop, payload);
      break;

    case "CUSTOMERS_REDACT":
      await handleCustomersRedact(shop, payload);
      break;

    case "SHOP_REDACT":
      await handleShopRedact(shop);
      break;

    default:
      console.log(`[Webhook] Unhandled topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};

/**
 * Handle app uninstallation
 * Clean up session data when app is uninstalled
 */
async function handleAppUninstalled(shop: string) {
  console.log(`[Webhook] App uninstalled from ${shop}`);

  try {
    // Delete session data
    await prisma.session.deleteMany({
      where: { shop },
    });

    // Optionally mark shop as inactive (keep data for potential reinstall)
    await prisma.shop.update({
      where: { shopDomain: shop },
      data: {
        // Could add an 'isActive' field to track this
        updatedAt: new Date(),
      },
    }).catch(() => {
      // Shop may not exist in our database yet
    });

    console.log(`[Webhook] Cleaned up session for ${shop}`);
  } catch (error) {
    console.error(`[Webhook] Error handling uninstall for ${shop}:`, error);
  }
}

/**
 * Handle customer data request (GDPR)
 * Customer requests a copy of their data
 *
 * Note: LatentSEO doesn't store customer personal data directly.
 * We only store product SEO data associated with the shop.
 */
async function handleCustomersDataRequest(
  shop: string,
  payload: {
    shop_id: number;
    shop_domain: string;
    customer: {
      id: number;
      email: string;
      phone: string;
    };
    orders_requested: number[];
  }
) {
  console.log(`[Webhook] Customer data request from ${shop}`);
  console.log(`[Webhook] Customer ID: ${payload.customer?.id}`);

  // LatentSEO does not store customer personal data
  // We only store product SEO metadata (titles, descriptions, alt text)
  // which is not tied to individual customers.

  // If we stored customer data, we would:
  // 1. Query all data associated with this customer
  // 2. Format it for delivery
  // 3. Send it to the shop owner or designated endpoint

  // For compliance, log that we received and processed the request
  console.log(`[Webhook] Customer data request processed - no customer data stored`);
}

/**
 * Handle customer data redaction (GDPR)
 * Customer requests deletion of their data
 *
 * Note: LatentSEO doesn't store customer personal data.
 */
async function handleCustomersRedact(
  shop: string,
  payload: {
    shop_id: number;
    shop_domain: string;
    customer: {
      id: number;
      email: string;
      phone: string;
    };
    orders_to_redact: number[];
  }
) {
  console.log(`[Webhook] Customer redact request from ${shop}`);
  console.log(`[Webhook] Customer ID: ${payload.customer?.id}`);

  // LatentSEO does not store customer personal data
  // No action needed as we don't have customer-specific data to delete

  // For compliance, log that we received and processed the request
  console.log(`[Webhook] Customer redact request processed - no customer data to delete`);
}

/**
 * Handle shop data redaction (GDPR)
 * Shop requests complete deletion of all their data
 * This is called 48 hours after app uninstallation
 */
async function handleShopRedact(shop: string) {
  console.log(`[Webhook] Shop redact request from ${shop}`);

  try {
    // Delete all optimization logs for this shop
    const deletedLogs = await prisma.optimizationLog.deleteMany({
      where: { shopDomain: shop },
    });
    console.log(`[Webhook] Deleted ${deletedLogs.count} optimization logs`);

    // Delete all jobs for this shop
    const deletedJobs = await prisma.job.deleteMany({
      where: { shopDomain: shop },
    });
    console.log(`[Webhook] Deleted ${deletedJobs.count} jobs`);

    // Delete usage records for this shop
    const deletedUsage = await prisma.usageRecord.deleteMany({
      where: { shopDomain: shop },
    });
    console.log(`[Webhook] Deleted ${deletedUsage.count} usage records`);

    // Delete shop settings
    const deletedShop = await prisma.shop.deleteMany({
      where: { shopDomain: shop },
    });
    console.log(`[Webhook] Deleted ${deletedShop.count} shop records`);

    // Delete any remaining sessions
    const deletedSessions = await prisma.session.deleteMany({
      where: { shop },
    });
    console.log(`[Webhook] Deleted ${deletedSessions.count} sessions`);

    console.log(`[Webhook] Shop redact complete for ${shop}`);
  } catch (error) {
    console.error(`[Webhook] Error during shop redact for ${shop}:`, error);
    // Still return 200 to acknowledge receipt
  }
}
