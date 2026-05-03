import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getAuthItemDetail } from "../models/auth-items.server";
import { ensureShopRecord } from "../models/shop.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  if (!params.authItemId) {
    throw new Response("Auth item id is required.", { status: 400 });
  }

  const authItem = await getAuthItemDetail(shop.id, params.authItemId);

  if (!authItem) {
    throw new Response("Auth item not found.", { status: 404 });
  }

  return authItem;
};

export default function AuthItemDetailPage() {
  const { item, scans, claims, transfers, flags } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title detail-heading">
            <span className="eyebrow">Unit record</span>
            <h1>{item.authId}</h1>
            <p>
              {item.productTitle} / {item.variantTitle}
            </p>
          </div>
          <div className="button-row">
            <Link className="button" to="/app/auth-items">
              Back to list
            </Link>
          </div>
        </div>

        <div className="detail-grid">
          <article className="panel detail-card">
            <div className="detail-meta">
              <span>Registry metadata</span>
              <span>{item.serialNumber}</span>
            </div>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{item.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Claim state</dt>
                <dd>{item.claimStatus.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Risk state</dt>
                <dd>{item.riskState.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{item.ownerName}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{item.createdAt}</dd>
              </div>
              <div>
                <dt>Activated</dt>
                <dd>{item.activatedAt}</dd>
              </div>
            </dl>
          </article>

          <article className="panel detail-card">
            <div className="detail-meta">
              <span>Scanning + security</span>
              <span>Token ending {item.qrTokenLast4}</span>
            </div>
            <p>
              Public verify tokens are hash-only at rest. QR assets can be
              exported at generation time; later admin surfaces keep only safe
              suffixes and audit traces.
            </p>
          </article>
        </div>
      </section>

      <section className="split-grid">
        <article className="panel table-card">
          <div className="panel__header">
            <div className="panel__title">
              <span className="eyebrow">Verification timeline</span>
              <h2>Recent scans</h2>
            </div>
          </div>
          {scans.length ? (
            <ul className="timeline-list">
              {scans.map((scan) => (
                <li key={scan.id}>
                  <strong>{scan.result.replaceAll("_", " ")}</strong>
                  <p>
                    {scan.countryCode} / {scan.deviceType} / {scan.scannedAt}
                  </p>
                  {scan.suspiciousReason ? <p>{scan.suspiciousReason}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <p>No scan history has been recorded yet.</p>
            </div>
          )}
        </article>

        <article className="panel table-card">
          <div className="panel__header">
            <div className="panel__title">
              <span className="eyebrow">Ownership activity</span>
              <h2>Claims + transfers</h2>
            </div>
          </div>
          <ul className="mini-list">
            {claims.map((claim) => (
              <li key={claim.id}>
                <strong>Claim / {claim.status.replaceAll("_", " ")}</strong>
                <p>
                  {claim.customer} / {claim.method.replaceAll("_", " ")}
                </p>
                <p>{claim.requestedAt}</p>
              </li>
            ))}
            {transfers.map((transfer) => (
              <li key={transfer.id}>
                <strong>Transfer / {transfer.status.replaceAll("_", " ")}</strong>
                <p>
                  {transfer.fromCustomer} → {transfer.toCustomer}
                </p>
                <p>Expires {transfer.expiresAt}</p>
              </li>
            ))}
            {!claims.length && !transfers.length ? (
              <li>
                <p>No claim or transfer history yet.</p>
              </li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className="panel table-card">
        <div className="panel__header">
          <div className="panel__title">
            <span className="eyebrow">Fraud posture</span>
            <h2>Risk flags</h2>
          </div>
        </div>
        {flags.length ? (
          <ul className="timeline-list">
            {flags.map((flag) => (
              <li key={flag.id}>
                <strong>
                  {flag.code} / {flag.severity}
                </strong>
                <p>{flag.reason}</p>
                <p>
                  {flag.state} / {flag.createdAt}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <p>No risk flags are attached to this item.</p>
          </div>
        )}
      </section>
    </main>
  );
}
