import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getDashboardSnapshot } from "../models/auth-items.server";
import { ensureShopRecord } from "../models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  return getDashboardSnapshot(shop.id);
};

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <section className="panel hero-grid">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span>Authenticity layer</span>
            <span>Ownership registry</span>
            <span>Product passport</span>
          </div>
          <h1>Meezy Archive Registry Control Room</h1>
          <p>
            This embedded admin handles product-linked authenticity items, QR
            generation, ownership state, transfer control, and fraud review
            inside a single Shopify-native operating surface.
          </p>
          <div className="button-row">
            <Link className="button--dark" to="/app/batches">
              Generate auth batch
            </Link>
            <Link className="button" to="/app/auth-items">
              Review auth items
            </Link>
          </div>
        </div>

        <aside className="hero-aside">
          <span className="eyebrow">Current focus</span>
          <ul className="mini-list panel">
            <li>
              <strong>Public verify</strong>
              <p>App proxy route prepared at `/a/verify/:token`.</p>
            </li>
            <li>
              <strong>Ownership binding</strong>
              <p>Reserved on `orders/paid`, activated on `fulfillments/create`.</p>
            </li>
            <li>
              <strong>Risk posture</strong>
              <p>Country hopping, invalid token probing, and mismatch attempts.</p>
            </li>
          </ul>
        </aside>
      </section>

      <section className="metric-grid">
        <article className="panel stat-card">
          <span className="eyebrow">Auth Items</span>
          <strong>{data.metrics.totalAuthItems}</strong>
        </article>
        <article className="panel stat-card">
          <span className="eyebrow">Claimed / Owned</span>
          <strong>{data.metrics.claimedItems}</strong>
        </article>
        <article className="panel stat-card">
          <span className="eyebrow">Pending Claims</span>
          <strong>{data.metrics.pendingClaims}</strong>
        </article>
        <article className="panel stat-card">
          <span className="eyebrow">Risk Flags</span>
          <strong>{data.metrics.flaggedItems}</strong>
        </article>
      </section>

      <section className="split-grid">
        <article className="panel table-card">
          <div className="panel__header">
            <div className="panel__title">
              <span className="eyebrow">Recent verification activity</span>
              <h2>Latest scans</h2>
            </div>
            <Link className="button" to="/app/scan-logs">
              Full scan log
            </Link>
          </div>
          {data.recentScans.length ? (
            <table>
              <thead>
                <tr>
                  <th>Auth ID</th>
                  <th>Product</th>
                  <th>Result</th>
                  <th>Country</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentScans.map((scan) => (
                  <tr key={scan.id}>
                    <td className="table-card__value">{scan.authId}</td>
                    <td>{scan.productTitle}</td>
                    <td>
                      <span className={`status-pill status-pill--${scan.result.toLowerCase()}`}>
                        {scan.result.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>{scan.countryCode}</td>
                    <td>{scan.scannedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No scans yet. Seed the database or start verifying public items.</p>
            </div>
          )}
        </article>

        <article className="panel table-card">
          <div className="panel__header">
            <div className="panel__title">
              <span className="eyebrow">Ownership pipeline</span>
              <h2>Recent transfers</h2>
            </div>
            <Link className="button" to="/app/transfers">
              Transfer center
            </Link>
          </div>
          {data.recentTransfers.length ? (
            <ul className="mini-list">
              {data.recentTransfers.map((transfer) => (
                <li key={transfer.id}>
                  <strong>{transfer.authItemId}</strong>
                  <p>
                    {transfer.fromCustomer} → {transfer.toCustomer}
                  </p>
                  <p>{transfer.status} / expires {transfer.expiresAt}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <p>No transfer activity yet. Transfer events will surface here.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
