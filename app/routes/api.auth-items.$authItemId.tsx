import type { LoaderFunctionArgs } from "react-router";
import { getAuthItemDetail } from "../models/auth-items.server";
import { ensureShopRecord } from "../models/shop.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  if (!params.authItemId) {
    return Response.json({ error: "authItemId is required." }, { status: 400 });
  }

  const authItem = await getAuthItemDetail(shop.id, params.authItemId);

  if (!authItem) {
    return Response.json({ error: "Auth item not found." }, { status: 404 });
  }

  return Response.json(authItem);
};
