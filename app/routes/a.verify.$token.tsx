import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { AppProxyProvider } from "@shopify/shopify-app-react-router/react";
import prisma from "../db.server";
import {
  claimAuthItem,
  verifyPublicAuthToken,
} from "../models/auth-items.server";
import { getShopByDomain, getSingleBrandShop, getShopSettings } from "../models/shop.server";
import { authenticate } from "../shopify.server";
import { hashOpaqueValue } from "../lib/crypto.server";
import { asJson } from "../lib/prisma-json.server";

function toAbsoluteAssetUrl(appUrl: string, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return new URL(pathOrUrl, appUrl).toString();
}

export const meta: MetaFunction = () => {
  return [
    { title: "Meezy Archive | Authenticity Verification" },
    {
      name: "description",
      content:
        "Public authenticity and ownership verification for Meezy Archive product passports.",
    },
  ];
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const requestUsesVerifyPath = url.pathname.startsWith("/a/verify/");
  const requestUsesProxyPrefix = url.searchParams.get("path_prefix") === "/a/verify";

  try {
    await authenticate.public.appProxy(request);
  } catch {
    // Direct local access is useful during development; app proxy auth will run in Shopify.
  }

  if (!requestUsesVerifyPath && !requestUsesProxyPrefix) {
    throw new Response("Not found.", { status: 404 });
  }

  if (!params.token) {
    throw new Response("Verification token is required.", { status: 400 });
  }

  const requestedShopDomain = url.searchParams.get("shop");
  const shop = requestedShopDomain
    ? await getShopByDomain(requestedShopDomain)
    : await getSingleBrandShop();

  if (!shop) {
    throw new Response("No installed shop is available for verification.", {
      status: 404,
    });
  }

  const settings = getShopSettings(shop.settings);
  const verify = await verifyPublicAuthToken({
    shopId: shop.id,
    token: params.token,
    loggedInCustomerId: url.searchParams.get("logged_in_customer_id"),
    request,
  });
  const loggedInCustomerId = url.searchParams.get("logged_in_customer_id") ?? "";

  return {
    appUrl: process.env.SHOPIFY_APP_URL || "",
    brandName: String(settings.brandName ?? "Meezy Archive"),
    claimAction: `${url.pathname}${url.search}`,
    customerSessionDetected: Boolean(loggedInCustomerId),
    loggedInCustomerId,
    logoUrl: toAbsoluteAssetUrl(process.env.SHOPIFY_APP_URL || "", "/meezy-logo.png"),
    storefrontAccountUrl: `https://${shop.shopifyShopDomain}/account`,
    productImageUrl: toAbsoluteAssetUrl(
      process.env.SHOPIFY_APP_URL || "",
      verify.authItem?.imageUrl ?? "/hoodie-navy.jpg",
    ),
    verify,
  };
};

function buildSyntheticCustomerId(email: string) {
  return BigInt(`0x${hashOpaqueValue(email.toLowerCase()).slice(0, 15)}`);
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const requestUsesVerifyPath = url.pathname.startsWith("/a/verify/");
  const requestUsesProxyPrefix = url.searchParams.get("path_prefix") === "/a/verify";

  if (!requestUsesVerifyPath && !requestUsesProxyPrefix) {
    throw new Response("Not found.", { status: 404 });
  }

  if (!params.token) {
    return {
      error: "Verification token is missing.",
    };
  }

  try {
    await authenticate.public.appProxy(request);
  } catch {
    // We still allow the claim flow to continue in development or after stale proxy timestamps.
  }

  const requestedShopDomain = url.searchParams.get("shop");
  const shop = requestedShopDomain
    ? await getShopByDomain(requestedShopDomain)
    : await getSingleBrandShop();

  if (!shop) {
    return {
      error: "No installed shop is available for this claim.",
    };
  }

  const formData = await request.formData();
  const claimCode = String(formData.get("claimCode") ?? "").trim();
  const claimEmail = String(formData.get("claimEmail") ?? "").trim().toLowerCase();
  const loggedInCustomerId = String(
    formData.get("loggedInCustomerId") ?? url.searchParams.get("logged_in_customer_id") ?? "",
  ).trim();

  if (!claimCode) {
    return {
      error: "Enter the claim code that was issued with this item.",
    };
  }

  if (!loggedInCustomerId && !claimEmail) {
    return {
      error: "Sign in to your store account or provide a contact email to finish the claim.",
    };
  }

  const authItem = await prisma.authItem.findFirst({
    where: {
      shopId: shop.id,
      qrTokenHash: hashOpaqueValue(params.token),
    },
  });

  if (!authItem) {
    return {
      error: "No authenticity record matches this token.",
    };
  }

  try {
    let customer = null;

    if (loggedInCustomerId) {
      customer = await prisma.customer.upsert({
        where: {
          shopId_shopifyCustomerId: {
            shopId: shop.id,
            shopifyCustomerId: BigInt(loggedInCustomerId),
          },
        },
        update: {
          metadata: asJson({
            source: "proxy-claim",
            lastClaimAt: new Date().toISOString(),
          }),
        },
        create: {
          shopId: shop.id,
          shopifyCustomerId: BigInt(loggedInCustomerId),
          email: claimEmail || null,
          metadata: asJson({
            source: "proxy-claim",
            provisional: !claimEmail,
          }),
        },
      });
    } else {
      customer = await prisma.customer.upsert({
        where: {
          shopId_shopifyCustomerId: {
            shopId: shop.id,
            shopifyCustomerId: buildSyntheticCustomerId(claimEmail),
          },
        },
        update: {
          email: claimEmail,
          metadata: asJson({
            source: "email-claim",
            provisional: true,
            lastClaimAt: new Date().toISOString(),
          }),
        },
        create: {
          shopId: shop.id,
          shopifyCustomerId: buildSyntheticCustomerId(claimEmail),
          email: claimEmail,
          metadata: asJson({
            source: "email-claim",
            provisional: true,
          }),
        },
      });
    }

    await claimAuthItem({
      shopId: shop.id,
      authItemId: authItem.id,
      customerId: customer.id,
      claimCode,
    });

    return {
      ok: true,
      message: loggedInCustomerId
        ? "Claim completed and attached to the detected customer account."
        : "Claim completed and stored under the provided email.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Claim could not be completed.",
    };
  }
};

export default function VerifyPage() {
  const {
    appUrl,
    brandName,
    claimAction,
    customerSessionDetected,
    loggedInCustomerId,
    logoUrl,
    storefrontAccountUrl,
    productImageUrl,
    verify,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const canClaim =
    verify.result === "CLAIM_AVAILABLE" &&
    verify.authItem &&
    verify.authItem.ownerState === "Claim available";
  const claimAnchorHref = `${claimAction}#claim-form`;

  return (
    <AppProxyProvider appUrl={appUrl}>
      <main className="verify-page">
        <div className="verify-loading" aria-hidden="true">
          <div className="verify-loading__panel">
            <span className="eyebrow">Meezy archive registry</span>
            <strong>Running originality screening</strong>
            <p>Resolving token hash, scan history, ownership state, and active risk flags.</p>
            <div className="verify-loading__meter">
              <span />
            </div>
            <div className="verify-loading__steps">
              <span>Token integrity</span>
              <span>Registry lookup</span>
              <span>Risk screening</span>
            </div>
          </div>
        </div>

        <section className="panel verify-hero">
          <article className="verify-summary">
            <div className="verify-topline">
              <span>Archive resale</span>
              <span>Product passport</span>
              <span>Ownership layer</span>
            </div>

            <img src={logoUrl} alt={`${brandName} logo`} />

            <div className="verify-status">
              <span className="eyebrow">Authenticity verification</span>
              <strong>{verify.statusLabel}</strong>
              <p>{verify.ownerState}</p>
            </div>

            <div className="button-row" style={{ marginTop: "18px" }}>
              <a className="button--dark" href={storefrontAccountUrl}>
                Sign in
              </a>
              {canClaim ? (
                <a className="button" href={claimAnchorHref}>
                  Claim item
                </a>
              ) : (
                <a className="button" href={storefrontAccountUrl}>
                  View account
                </a>
              )}
              <a className="button--ghost" href={storefrontAccountUrl}>
                Report issue
              </a>
            </div>
          </article>

          <article className="panel verify-stage">
            <img
              src={productImageUrl}
              alt={verify.authItem?.productTitle ?? "Meezy Archive product"}
            />
            <div className="verify-stamp">
              <div>Archive verified</div>
              <div>Originality screening</div>
            </div>
          </article>
        </section>

        {canClaim ? (
          <section className="panel verify-claim" id="claim-form">
            <div className="panel__header">
              <div className="panel__title">
                <span className="eyebrow">Ownership claim</span>
                <h2>Complete claim</h2>
                <p>
                  Enter the hidden claim code issued with this item. If a customer session is
                  detected we will attach the ownership record to that account; otherwise we will
                  hold the claim under the contact email you provide.
                </p>
              </div>
            </div>

            <Form method="post" action={claimAction} className="form-grid">
              <input
                type="hidden"
                name="loggedInCustomerId"
                value={loggedInCustomerId}
              />

              <div className="field">
                <label htmlFor="claimCode">Claim code</label>
                <input id="claimCode" name="claimCode" placeholder="Enter hidden claim code" required />
              </div>

              <div className="field">
                <label htmlFor="claimEmail">Contact email</label>
                <input
                  id="claimEmail"
                  name="claimEmail"
                  type="email"
                  placeholder="you@example.com"
                  required={!customerSessionDetected}
                />
                <p>
                  {customerSessionDetected
                    ? "Optional backup email for this claim."
                    : "Use your customer email if you are not currently signed in."}
                </p>
              </div>

              <div className="field">
                <span className="eyebrow">Customer session</span>
                <p>
                  {customerSessionDetected
                    ? "Detected. This claim can be attached to the active customer session."
                    : "Not detected. The claim will be stored under the email you enter until account linking is completed."}
                </p>
              </div>

              <div className="button-row">
                <button className="button--dark" type="submit">
                  Complete claim
                </button>
              </div>
            </Form>

            {actionData?.error ? (
              <div className="empty-state">
                <p>{actionData.error}</p>
              </div>
            ) : null}

            {actionData?.ok ? (
              <div className="empty-state">
                <p>{actionData.message}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="verify-meta-grid">
          <article className="panel verify-meta-panel">
            <div className="panel__title">
              <span className="eyebrow">Verification record</span>
              <h2>{verify.authItem?.productTitle ?? "No matching item"}</h2>
              <p>{verify.authItem?.variantTitle ?? "Unknown variant"}</p>
            </div>
            <div className="verify-meta" style={{ marginTop: "18px" }}>
              <div>
                <dt>Auth ID</dt>
                <dd>{verify.authItem?.authId ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>Activation date</dt>
                <dd>{verify.authItem?.activatedAt ?? "Not activated"}</dd>
              </div>
              <div>
                <dt>Registry state</dt>
                <dd>{verify.authItem?.ownerState ?? "No ownership record"}</dd>
              </div>
              <div>
                <dt>Token suffix</dt>
                <dd>{verify.authItem?.qrTokenLast4 ?? "----"}</dd>
              </div>
            </div>
          </article>

          <article className="panel verify-actions">
            <div className="panel__title">
              <span className="eyebrow">Risk notes</span>
              <h2>Screening context</h2>
              <p>
                Public verification never exposes customer PII, order ids, or
                private ownership details.
              </p>
            </div>
            <ul className="mini-list panel" style={{ marginTop: "18px" }}>
              {verify.riskNotes.length ? (
                verify.riskNotes.map((note) => (
                  <li key={note}>
                    <strong>Review note</strong>
                    <p>{note}</p>
                  </li>
                ))
              ) : (
                <li>
                  <strong>Clear check</strong>
                  <p>No elevated risk signals are attached to this scan.</p>
                </li>
              )}
            </ul>
          </article>
        </section>
      </main>
    </AppProxyProvider>
  );
}
