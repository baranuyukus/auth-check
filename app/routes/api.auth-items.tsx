import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { createAuthItemBatch, listAuthItems } from "../models/auth-items.server";
import { ensureShopRecord, getShopSettings } from "../models/shop.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  return Response.json({
    authItems: await listAuthItems(shop.id),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });
  const settings = getShopSettings(shop.settings);
  const payload = (await request.json()) as {
    productId?: string;
    quantity?: number;
  };

  if (!payload.productId || !payload.quantity) {
    return Response.json(
      { error: "productId and quantity are required." },
      { status: 400 },
    );
  }

  const batch = await createAuthItemBatch({
    shopId: shop.id,
    shopDomain: shop.shopifyShopDomain,
    productId: payload.productId,
    quantity: Math.min(payload.quantity, 50),
    actorId: session.shop,
    verifyPath: String(settings.verifyPath ?? "/a/verify"),
  });

  return Response.json(batch);
};
