import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShopRecord } from "../models/shop.server";
import { listRiskFlags } from "../models/auth-items.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  return {
    flags: await listRiskFlags(shop.id),
  };
};

export default function FlagsPage() {
  const { flags } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <section className="panel table-card">
        <div className="panel__header">
          <div className="panel__title">
            <span className="eyebrow">Fraud queue</span>
            <h1>Risk flags</h1>
            <p>
              Country hopping, repeated failed claims, and ownership mismatches
              appear here for manual review.
            </p>
          </div>
        </div>

        {flags.length ? (
          <table>
            <thead>
              <tr>
                <th>Auth ID</th>
                <th>Code</th>
                <th>Severity</th>
                <th>State</th>
                <th>Reason</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id}>
                  <td className="table-card__value">{flag.authId}</td>
                  <td>{flag.code}</td>
                  <td>{flag.severity}</td>
                  <td>{flag.state}</td>
                  <td>{flag.reason}</td>
                  <td>{flag.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>No risk flags are currently open.</p>
          </div>
        )}
      </section>
    </main>
  );
}
