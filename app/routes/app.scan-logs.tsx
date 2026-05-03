import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShopRecord } from "../models/shop.server";
import { listScanLogs } from "../models/auth-items.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });

  return {
    scans: await listScanLogs(shop.id),
  };
};

export default function ScanLogsPage() {
  const { scans } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <section className="panel table-card">
        <div className="panel__header">
          <div className="panel__title">
            <span className="eyebrow">Verification telemetry</span>
            <h1>Scan logs</h1>
            <p>
              Public, customer, and internal scans accumulate here for review
              and anomaly detection.
            </p>
          </div>
        </div>

        {scans.length ? (
          <table>
            <thead>
              <tr>
                <th>Auth ID</th>
                <th>Result</th>
                <th>Country</th>
                <th>Device</th>
                <th>Suspicious</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.id}>
                  <td className="table-card__value">{scan.authId}</td>
                  <td>{scan.result.replaceAll("_", " ")}</td>
                  <td>{scan.countryCode}</td>
                  <td>{scan.deviceType}</td>
                  <td>{scan.suspicious ? "Yes" : "No"}</td>
                  <td>{scan.scannedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>No scan events recorded yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}
