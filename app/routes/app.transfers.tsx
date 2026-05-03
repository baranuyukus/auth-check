import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { listTransfers } from "../models/auth-items.server";
import { ensureShopRecord } from "../models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  return {
    transfers: await listTransfers(shop.id),
  };
};

export default function TransfersPage() {
  const { transfers } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <section className="panel table-card">
        <div className="panel__header">
          <div className="panel__title">
            <span className="eyebrow">Ownership handoff</span>
            <h1>Transfers</h1>
            <p>
              Monitor one-time transfer flows, expirations, and completed
              ownership handoffs.
            </p>
          </div>
        </div>

        {transfers.length ? (
          <table>
            <thead>
              <tr>
                <th>Auth ID</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th>Created</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td className="table-card__value">{transfer.authId}</td>
                  <td>{transfer.fromCustomer}</td>
                  <td>{transfer.toCustomer}</td>
                  <td>
                    <span className={`status-pill status-pill--${transfer.status.toLowerCase()}`}>
                      {transfer.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>{transfer.createdAt}</td>
                  <td>{transfer.expiresAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>No transfers have been started yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}
