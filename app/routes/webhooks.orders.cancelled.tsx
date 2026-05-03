import type { ActionFunctionArgs } from "react-router";
import { cancelReservedAuthItems } from "../models/auth-items.server";
import { getShopByDomain } from "../models/shop.server";
import {
  markWebhookFailed,
  markWebhookProcessed,
  markWebhookProcessing,
  recordWebhookReceipt,
} from "../models/webhook-events.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  const payload = (await request.json()) as Record<string, unknown>;
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? crypto.randomUUID();
  const shopRecord = await getShopByDomain(shop);

  if (!shopRecord) {
    return new Response();
  }

  const receipt = await recordWebhookReceipt({
    shopId: shopRecord.id,
    topic,
    webhookId,
    payload,
    headers: Object.fromEntries(request.headers.entries()),
  });

  if (receipt.duplicate) {
    return new Response();
  }

  await markWebhookProcessing(receipt.event.id);

  try {
    await cancelReservedAuthItems({
      shopId: shopRecord.id,
      orderId: typeof payload.id === "number" ? payload.id : undefined,
    });
    await markWebhookProcessed(receipt.event.id);
    return new Response();
  } catch (error) {
    await markWebhookFailed(
      receipt.event.id,
      error instanceof Error ? error.message : "Unknown orders/cancelled error",
    );
    throw error;
  }
};
