import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { asJson } from "../lib/prisma-json.server";
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
    if (typeof payload.id === "number") {
      await prisma.customer.upsert({
        where: {
          shopId_shopifyCustomerId: {
            shopId: shopRecord.id,
            shopifyCustomerId: BigInt(payload.id),
          },
        },
        update: {
          email: typeof payload.email === "string" ? payload.email : null,
          firstName:
            typeof payload.first_name === "string" ? payload.first_name : null,
          lastName:
            typeof payload.last_name === "string" ? payload.last_name : null,
          metadata: asJson(payload),
        },
        create: {
          shopId: shopRecord.id,
          shopifyCustomerId: BigInt(payload.id),
          email: typeof payload.email === "string" ? payload.email : null,
          firstName:
            typeof payload.first_name === "string" ? payload.first_name : null,
          lastName:
            typeof payload.last_name === "string" ? payload.last_name : null,
          metadata: asJson(payload),
        },
      });
    }

    await markWebhookProcessed(receipt.event.id);
    return new Response();
  } catch (error) {
    await markWebhookFailed(
      receipt.event.id,
      error instanceof Error ? error.message : "Unknown customers/create error",
    );
    throw error;
  }
};
