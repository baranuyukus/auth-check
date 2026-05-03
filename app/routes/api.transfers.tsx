import type { ActionFunctionArgs } from "react-router";
import { acceptTransfer, startTransfer } from "../models/auth-items.server";
import { ensureShopRecord } from "../models/shop.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });
  const payload = (await request.json()) as
    | {
        intent: "start";
        authItemId?: string;
        fromCustomerId?: string;
      }
    | {
        intent: "accept";
        authItemId?: string;
        customerId?: string;
        transferCode?: string;
      };

  if (payload.intent === "start") {
    if (!payload.authItemId || !payload.fromCustomerId) {
      return Response.json(
        { error: "authItemId and fromCustomerId are required." },
        { status: 400 },
      );
    }

    const transfer = await startTransfer({
      shopId: shop.id,
      authItemId: payload.authItemId,
      fromCustomerId: payload.fromCustomerId,
      actorId: session.shop,
    });

    return Response.json(transfer);
  }

  if (!payload.authItemId || !payload.customerId || !payload.transferCode) {
    return Response.json(
      { error: "authItemId, customerId, and transferCode are required." },
      { status: 400 },
    );
  }

  await acceptTransfer({
    shopId: shop.id,
    authItemId: payload.authItemId,
    customerId: payload.customerId,
    transferCode: payload.transferCode,
  });

  return Response.json({ ok: true });
};
