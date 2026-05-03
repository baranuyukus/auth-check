import { WebhookDeliveryState } from "@prisma/client";
import prisma from "../db.server";

export async function recordWebhookReceipt(params: {
  shopId: string;
  topic: string;
  webhookId: string;
  payload: unknown;
  headers: Record<string, string>;
}) {
  const existing = await prisma.webhookEvent.findUnique({
    where: { webhookId: params.webhookId },
  });

  if (existing) {
    return { duplicate: true, event: existing };
  }

  const event = await prisma.webhookEvent.create({
    data: {
      shopId: params.shopId,
      topic: params.topic,
      webhookId: params.webhookId,
      payload: params.payload as object,
      headers: params.headers as object,
      deliveryState: WebhookDeliveryState.RECEIVED,
    },
  });

  return { duplicate: false, event };
}

export async function markWebhookProcessing(webhookEventId: string) {
  return prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      deliveryState: WebhookDeliveryState.PROCESSING,
      attempts: { increment: 1 },
    },
  });
}

export async function markWebhookProcessed(webhookEventId: string) {
  return prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      deliveryState: WebhookDeliveryState.PROCESSED,
      processedAt: new Date(),
    },
  });
}

export async function markWebhookFailed(
  webhookEventId: string,
  lastError: string,
) {
  return prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      deliveryState: WebhookDeliveryState.FAILED,
      lastError,
    },
  });
}
