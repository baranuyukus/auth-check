import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShopRecord } from "../models/shop.server";
import { listAuthItems } from "../models/auth-items.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  return {
    authItems: await listAuthItems(shop.id),
  };
};

export default function AuthItemsPage() {
  const { authItems } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <section className="panel table-card">
        <div className="panel__header">
          <div className="panel__title">
            <span className="eyebrow">Registry surface</span>
            <h1>Auth items</h1>
            <p>
              Review per-unit authenticity records, ownership state, and last
              verification activity.
            </p>
          </div>
          <Link className="button--dark" to="/app/batches">
            Generate batch
          </Link>
        </div>

        {authItems.length ? (
          <table>
            <thead>
              <tr>
                <th>Auth ID</th>
                <th>Product</th>
                <th>Status</th>
                <th>Claim</th>
                <th>Owner</th>
                <th>Last scan</th>
              </tr>
            </thead>
            <tbody>
              {authItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="table-card__value" to={`/app/auth-items/${item.id}`}>
                      {item.authId}
                    </Link>
                  </td>
                  <td>
                    {item.productTitle}
                    <br />
                    <span className="eyebrow">{item.variantTitle}</span>
                  </td>
                  <td>
                    <span className={`status-pill status-pill--${item.status.toLowerCase()}`}>
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-pill status-pill--${item.claimStatus.toLowerCase()}`}
                    >
                      {item.claimStatus.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>{item.ownerName}</td>
                  <td>{item.lastScanAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>
              No auth items exist yet. Generate a batch for a synced product to
              start issuing unit-level authenticity records.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
