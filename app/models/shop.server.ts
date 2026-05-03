import prisma from "../db.server";
import { asJson } from "../lib/prisma-json.server";

const defaultSettings = {
  brandName: "Meezy Archive",
  verifyPath: "/a/verify",
  transferTtlHours: 24,
  claimSecondFactorRequired: true,
  customerAccountMode: "new-accounts-only",
  launchModel: "single-brand-custom-distributed",
};

function pseudoEncryptAccessToken(accessToken?: string | null) {
  if (!accessToken) {
    return null;
  }

  return Buffer.from(accessToken, "utf8").toString("base64");
}

export async function ensureShopRecord(params: {
  shopifyShopDomain: string;
  accessToken?: string | null;
}) {
  const { shopifyShopDomain, accessToken } = params;

  return prisma.shop.upsert({
    where: { shopifyShopDomain },
    update: {
      installedAt: new Date(),
      accessTokenEncrypted: pseudoEncryptAccessToken(accessToken),
      settings: defaultSettings,
    },
    create: {
      shopifyShopDomain,
      displayName: "Meezy Archive",
      accessTokenEncrypted: pseudoEncryptAccessToken(accessToken),
      installedAt: new Date(),
      settings: defaultSettings,
    },
  });
}

export async function getShopByDomain(shopifyShopDomain: string) {
  return prisma.shop.findUnique({
    where: { shopifyShopDomain },
  });
}

export async function getSingleBrandShop() {
  return prisma.shop.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

export async function updateShopSettings(shopId: string, settings: unknown) {
  const mergedSettings = getShopSettings(settings);

  return prisma.shop.update({
    where: { id: shopId },
    data: {
      settings: asJson(mergedSettings),
    },
  });
}

export function getShopSettings(
  settings: unknown,
): typeof defaultSettings & Record<string, unknown> {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return {
      ...defaultSettings,
      ...(settings as Record<string, unknown>),
    };
  }

  return defaultSettings;
}
