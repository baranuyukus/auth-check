import type { ActionFunctionArgs } from "react-router";
import { claimAuthItem } from "../models/auth-items.server";
import { ensureShopRecord } from "../models/shop.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });
  const payload = (await request.json()) as {
    authItemId?: string;
    customerId?: string;
    claimCode?: string;
  };

  if (!payload.authItemId || !payload.customerId || !payload.claimCode) {
    return Response.json(
      { error: "authItemId, customerId, and claimCode are required." },
      { status: 400 },
    );
  }

  await claimAuthItem({
    shopId: shop.id,
    authItemId: payload.authItemId,
    customerId: payload.customerId,
    claimCode: payload.claimCode,
  });

  return Response.json({ ok: true });
};
