import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { handleSubscriptionWebhook } from "../services/billing.server";
import { prisma } from "../db.server";

/**
 * Webhook handler for Shopify billing events
 *
 * Handles:
 * - APP_SUBSCRIPTIONS_UPDATE: Subscription status changes
 * - APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT: Usage limit warning
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`[Billing Webhook] Received ${topic} for ${shop}`);

    switch (topic) {
      case "APP_SUBSCRIPTIONS_UPDATE": {
        await handleSubscriptionWebhook(shop, payload as {
          app_subscription?: {
            admin_graphql_api_id: string;
            status: string;
            name: string;
          };
        });
        break;
      }

      case "APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT": {
        // Log warning - could send notification email
        console.log(`[Billing Webhook] ${shop} approaching capped amount`);
        break;
      }

      case "APP_UNINSTALLED": {
        // Clean up subscription on uninstall
        console.log(`[Billing Webhook] App uninstalled from ${shop}`);
        await prisma.subscription.updateMany({
          where: { shopDomain: shop },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        break;
      }

      default:
        console.log(`[Billing Webhook] Unhandled topic: ${topic}`);
    }

    return json({ success: true });
  } catch (error) {
    console.error("[Billing Webhook] Error:", error);
    // Return 200 to prevent Shopify retries for non-recoverable errors
    return json({ success: false, error: String(error) }, { status: 200 });
  }
};
