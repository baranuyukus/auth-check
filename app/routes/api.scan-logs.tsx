import type { LoaderFunctionArgs } from "react-router";
import { listScanLogs } from "../models/auth-items.server";
import { ensureShopRecord } from "../models/shop.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  return Response.json({
    scans: await listScanLogs(shop.id),
  });
};
