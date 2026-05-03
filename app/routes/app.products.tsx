import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { listProducts } from "../models/auth-items.server";
import { syncProductsFromAdminApi } from "../models/products.server";
import { ensureShopRecord } from "../models/shop.server";

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
  };
};

export default function ProductsPage() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <section className="panel table-card">
        <div className="panel__header">
          <div className="panel__title">
            <span className="eyebrow">Variant registry source</span>
            <h1>Products</h1>
            <p>
              Product rows are variant-scoped and used as the source for auth
              item batch generation.
            </p>
          </div>
          <Link className="button--dark" to="/app/batches">
            Create batch
          </Link>
        </div>

        {products.length ? (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th>Auth items</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="table-card__value">{product.title}</td>
                  <td>{product.variantTitle}</td>
                  <td>{product.sku}</td>
                  <td>{product.authItemsCount}</td>
                  <td>{product.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>
              No products were synced yet. Make sure the shop has products, then
              reload this page to pull the latest variants into the registry.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
