import prisma from "../db.server";
import { asJson } from "../lib/prisma-json.server";

type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

function numericIdFromGid(value: unknown) {
  if (typeof value !== "string") return null;

  const match = value.match(/\/(\d+)$/);
  return match ? BigInt(match[1]) : null;
}

export async function syncProductsFromWebhookPayload(
  shopId: string,
  payload: Record<string, unknown>,
) {
  const variants = Array.isArray(payload.variants)
    ? (payload.variants as Array<Record<string, unknown>>)
    : [];
  const image =
    payload.image && typeof payload.image === "object"
      ? (payload.image as Record<string, unknown>)
      : null;
  const imageSrc = typeof image?.src === "string" ? image.src : null;

  for (const variant of variants) {
    if (typeof variant.id !== "number" || typeof payload.id !== "number") {
      continue;
    }

    await prisma.product.upsert({
      where: {
        shopId_shopifyVariantId: {
          shopId,
          shopifyVariantId: BigInt(variant.id),
        },
      },
      update: {
        title: typeof payload.title === "string" ? payload.title : "Untitled product",
        variantTitle:
          typeof variant.title === "string" ? variant.title : "Default variant",
        sku: typeof variant.sku === "string" ? variant.sku : null,
        handle: typeof payload.handle === "string" ? payload.handle : null,
        vendor: typeof payload.vendor === "string" ? payload.vendor : null,
        productType:
          typeof payload.product_type === "string" ? payload.product_type : null,
        imageUrl: imageSrc,
        metadata: asJson({
          productPayload: payload,
          variantPayload: variant,
        }),
        isActive: true,
      },
      create: {
        shopId,
        shopifyProductId: BigInt(payload.id),
        shopifyVariantId: BigInt(variant.id),
        title: typeof payload.title === "string" ? payload.title : "Untitled product",
        variantTitle:
          typeof variant.title === "string" ? variant.title : "Default variant",
        sku: typeof variant.sku === "string" ? variant.sku : null,
        handle: typeof payload.handle === "string" ? payload.handle : null,
        vendor: typeof payload.vendor === "string" ? payload.vendor : null,
        productType:
          typeof payload.product_type === "string" ? payload.product_type : null,
        imageUrl: imageSrc,
        metadata: asJson({
          productPayload: payload,
          variantPayload: variant,
        }),
      },
    });
  }
}

export async function syncProductsFromAdminApi(
  shopId: string,
  admin: AdminGraphqlClient,
) {
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
      query RegistryProducts($first: Int!, $after: String) {
        products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            handle
            vendor
            productType
            featuredImage {
              url
            }
            variants(first: 50) {
              nodes {
                id
                title
                sku
              }
            }
          }
        }
      }`,
      {
        variables: {
          first: 40,
          after: cursor,
        },
      },
    );

    const payload = (await response.json()) as {
      data?: {
        products?: {
          pageInfo?: {
            hasNextPage?: boolean;
            endCursor?: string | null;
          };
          nodes?: Array<{
            id?: string;
            title?: string;
            handle?: string | null;
            vendor?: string | null;
            productType?: string | null;
            featuredImage?: {
              url?: string | null;
            } | null;
            variants?: {
              nodes?: Array<{
                id?: string;
                title?: string | null;
                sku?: string | null;
              }>;
            };
          }>;
        };
      };
      errors?: unknown;
    };

    if (payload.errors) {
      throw new Error("Shopify product sync failed.");
    }

    const products = payload.data?.products?.nodes ?? [];

    for (const product of products) {
      const productId = numericIdFromGid(product.id);

      if (!productId) {
        continue;
      }

      const variants = product.variants?.nodes ?? [];

      for (const variant of variants) {
        const variantId = numericIdFromGid(variant.id);

        if (!variantId) {
          continue;
        }

        await prisma.product.upsert({
          where: {
            shopId_shopifyVariantId: {
              shopId,
              shopifyVariantId: variantId,
            },
          },
          update: {
            title: product.title ?? "Untitled product",
            variantTitle: variant.title ?? "Default variant",
            sku: variant.sku ?? null,
            handle: product.handle ?? null,
            vendor: product.vendor ?? null,
            productType: product.productType ?? null,
            imageUrl: product.featuredImage?.url ?? null,
            metadata: asJson({
              source: "admin-graphql-sync",
              productGid: product.id ?? null,
              variantGid: variant.id ?? null,
            }),
            isActive: true,
          },
          create: {
            shopId,
            shopifyProductId: productId,
            shopifyVariantId: variantId,
            title: product.title ?? "Untitled product",
            variantTitle: variant.title ?? "Default variant",
            sku: variant.sku ?? null,
            handle: product.handle ?? null,
            vendor: product.vendor ?? null,
            productType: product.productType ?? null,
            imageUrl: product.featuredImage?.url ?? null,
            metadata: asJson({
              source: "admin-graphql-sync",
              productGid: product.id ?? null,
              variantGid: variant.id ?? null,
            }),
          },
        });
      }
    }

    hasNextPage = Boolean(payload.data?.products?.pageInfo?.hasNextPage);
    cursor = payload.data?.products?.pageInfo?.endCursor ?? null;
  }
}
