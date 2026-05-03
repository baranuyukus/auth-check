import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  NavLink,
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { ensureShopRecord, getShopSettings } from "../models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord({
    shopifyShopDomain: session.shop,
    accessToken: session.accessToken,
  });
  const settings = getShopSettings(shop.settings);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shopDomain: session.shop,
    brandName: String(settings.brandName ?? "Meezy Archive"),
  };
};

export default function App() {
  const { apiKey, shopDomain, brandName } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div className="admin-shell">
        <header className="admin-nav">
          <div className="admin-nav__brand">
            <img src="/meezy-logo.png" alt="Meezy Archive logo" />
            <div className="admin-nav__copy">
              <span className="eyebrow">Shopify Authenticity Registry</span>
              <strong>{brandName}</strong>
              <span className="eyebrow">{shopDomain}</span>
            </div>
          </div>

          <nav className="admin-links" aria-label="Primary">
            <NavLink to="/app" end>
              Dashboard
            </NavLink>
            <NavLink to="/app/auth-items">Auth Items</NavLink>
            <NavLink to="/app/products">Products</NavLink>
            <NavLink to="/app/batches">Batches</NavLink>
            <NavLink to="/app/transfers">Transfers</NavLink>
            <NavLink to="/app/scan-logs">Scan Logs</NavLink>
            <NavLink to="/app/flags">Flags</NavLink>
            <NavLink to="/app/settings">Settings</NavLink>
          </nav>
        </header>

        <Outlet />
      </div>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
