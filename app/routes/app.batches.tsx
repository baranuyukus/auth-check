import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import QRCode from "qrcode";
import { authenticate } from "../shopify.server";
import { toCsv } from "../lib/csv.server";
import { createAuthItemBatch, listProducts } from "../models/auth-items.server";
import { syncProductsFromAdminApi } from "../models/products.server";
import { ensureShopRecord, getShopSettings } from "../models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });
  let products = await listProducts(shop.id);

  if (!products.length) {
    await syncProductsFromAdminApi(shop.id, admin);
    products = await listProducts(shop.id);
  }

  return {
    products,
    verifyPath: String(getShopSettings(shop.settings).verifyPath ?? "/a/verify"),
    shopDomain: shop.shopifyShopDomain,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });
  const settings = getShopSettings(shop.settings);
  const formData = await request.formData();
  const productId = String(formData.get("productId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!productId || !quantity || quantity < 1) {
    return {
      error: "Choose a product variant and quantity before generating a batch.",
    };
  }

  const batch = await createAuthItemBatch({
    shopId: shop.id,
    shopDomain: shop.shopifyShopDomain,
    productId,
    quantity: Math.min(quantity, 50),
    actorId: session.shop,
    verifyPath: String(settings.verifyPath ?? "/a/verify"),
  });

  const items = await Promise.all(
    batch.items.map(async (item) => ({
      ...item,
      qrSvg: await QRCode.toString(item.verifyUrl, {
        type: "svg",
        margin: 0,
        width: 240,
        color: {
          dark: "#10110f",
          light: "#f1ede4",
        },
      }),
    })),
  );

  const csv = toCsv(
    items.map((item) => ({
      auth_id: item.authId,
      serial_number: item.serialNumber,
      verify_url: item.verifyUrl,
      token_last4: item.qrTokenLast4,
      claim_code: item.claimCode,
    })),
  );

  return {
    batchReference: batch.batchReference,
    productTitle: batch.product.title,
    items,
    csv,
  };
};

export default function BatchPage() {
  const { products, verifyPath, shopDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const generatedBatch =
    actionData && Array.isArray(actionData.items) ? actionData : null;
  const generatedItems = generatedBatch?.items ?? [];

  return (
    <main className="page">
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title">
            <span className="eyebrow">Registry issuance</span>
            <h1>Generate auth batch</h1>
            <p>
              Create per-unit `auth_id`, `serial_number`, secure QR token hash,
              and claim code material for a synced variant. Raw tokens are shown
              only once at generation time.
            </p>
          </div>
        </div>

        <Form method="post" className="form-grid">
          <div className="field">
            <label htmlFor="productId">Variant product</label>
            <select id="productId" name="productId" required>
              <option value="">Select a registry product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title} / {product.variantTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="quantity">Quantity</label>
            <input id="quantity" type="number" name="quantity" min="1" max="50" defaultValue="6" />
          </div>

          <div className="field">
            <label htmlFor="verifyPath">Verify route</label>
            <input id="verifyPath" value={verifyPath} readOnly />
            <p>Configured Shopify app proxy root.</p>
          </div>

          <div className="field">
            <label htmlFor="verifyBaseUrl">QR destination</label>
            <input
              id="verifyBaseUrl"
              value={`https://${shopDomain}${verifyPath}`}
              readOnly
            />
            <p>Generated QR codes point to the connected storefront domain.</p>
          </div>

          <div className="field">
            <span className="eyebrow">Secure issuance note</span>
            <p>
              The system stores only token hashes and safe suffixes. Export QR
              packs now; the raw secrets are not recoverable later.
            </p>
          </div>

          <div className="button-row">
            <button className="button--dark" type="submit">
              Generate secure batch
            </button>
          </div>
        </Form>

        {"error" in (actionData ?? {}) && actionData?.error ? (
          <div className="empty-state">
            <p>{actionData.error}</p>
          </div>
        ) : null}
      </section>

      {generatedBatch ? (
        <>
          <section className="panel">
            <div className="panel__header">
              <div className="panel__title">
                <span className="eyebrow">Issued batch</span>
                <h2>
                  {generatedBatch.batchReference} / {generatedBatch.productTitle}
                </h2>
                <p>
                  Export the CSV below or print the generated QR cards before
                  leaving this screen.
                </p>
              </div>
            </div>

            <div className="csv-block">
              <pre>{generatedBatch.csv}</pre>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div className="panel__title">
                <span className="eyebrow">QR issuance</span>
                <h2>Secure export preview</h2>
              </div>
            </div>
            <div className="qr-grid">
              {generatedItems.map((item) => (
                <article key={item.authId} className="qr-card">
                  <div className="qr-card__body">
                    <div
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: item.qrSvg }}
                    />
                    <strong>{item.authId}</strong>
                    <span className="eyebrow">{item.serialNumber}</span>
                    <span className="token-note">Claim code {item.claimCode}</span>
                    <span className="token-note">Token ending {item.qrTokenLast4}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
