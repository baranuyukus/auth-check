import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { ensureShopRecord, getShopSettings, updateShopSettings } from "../models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  return {
    shopDomain: shop.shopifyShopDomain,
    settings: getShopSettings(shop.settings),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });
  const formData = await request.formData();

  const nextSettings = {
    brandName: String(formData.get("brandName") ?? "Meezy Archive"),
    verifyPath: String(formData.get("verifyPath") ?? "/a/verify"),
    transferTtlHours: Number(formData.get("transferTtlHours") ?? 24),
    claimSecondFactorRequired: formData.get("claimSecondFactorRequired") === "on",
    customerAccountMode: "new-accounts-only",
    launchModel: "single-brand-custom-distributed",
  };

  await updateShopSettings(shop.id, nextSettings);

  await prisma.auditLog.create({
    data: {
      shopId: shop.id,
      actorType: "MERCHANT",
      actorId: session.shop,
      action: "shop.settings.updated",
      entityType: "shop",
      entityId: shop.id,
      payload: nextSettings,
    },
  });

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
  };
};

export default function SettingsPage() {
  const { shopDomain, settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="page">
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title">
            <span className="eyebrow">Registry policy</span>
            <h1>Settings</h1>
            <p>
              Launch is single-brand and custom-distributed, but settings remain
              shop-scoped so the service layer stays multi-tenant-ready.
            </p>
          </div>
        </div>

        <Form method="post" className="form-grid">
          <div className="field">
            <label htmlFor="brandName">Brand name</label>
            <input id="brandName" name="brandName" defaultValue={String(settings.brandName ?? "")} />
          </div>

          <div className="field">
            <label htmlFor="verifyPath">Verify path</label>
            <input id="verifyPath" name="verifyPath" defaultValue={String(settings.verifyPath ?? "")} />
          </div>

          <div className="field">
            <label htmlFor="transferTtlHours">Transfer TTL (hours)</label>
            <input
              id="transferTtlHours"
              name="transferTtlHours"
              type="number"
              min="1"
              defaultValue={String(settings.transferTtlHours ?? 24)}
            />
          </div>

          <div className="field">
            <label htmlFor="shopDomain">Connected shop</label>
            <input id="shopDomain" value={shopDomain} readOnly />
          </div>

          <div className="field">
            <label htmlFor="claimSecondFactorRequired">Claim security</label>
            <input
              id="claimSecondFactorRequired"
              name="claimSecondFactorRequired"
              type="checkbox"
              defaultChecked={Boolean(settings.claimSecondFactorRequired)}
            />
            <p>Require QR token plus hidden claim code for off-platform claims.</p>
          </div>

          <div className="button-row">
            <button className="button--dark" type="submit">
              Save settings
            </button>
          </div>
        </Form>

        {actionData?.ok ? (
          <div className="empty-state">
            <p>Settings updated at {actionData.updatedAt}.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
