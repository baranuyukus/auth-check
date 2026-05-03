import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
// We need both URL and inline variants for standard app pages and proxy pages.
// eslint-disable-next-line import/no-duplicates
import appStylesHref from "./app.css?url";
// eslint-disable-next-line import/no-duplicates
import appStylesInline from "./app.css?inline";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Michroma&display=swap",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const isProxyVerifyPage =
    url.pathname.startsWith("/a/verify/") ||
    url.searchParams.get("path_prefix") === "/a/verify";

  return {
    isProxyVerifyPage,
  };
};

export default function App() {
  const { isProxyVerifyPage } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        {isProxyVerifyPage ? (
          <style dangerouslySetInnerHTML={{ __html: appStylesInline }} />
        ) : (
          <link rel="stylesheet" href={appStylesHref} />
        )}
      </head>
      <body className="shell">
        <div className="shell">
          <Outlet />
        </div>
        {isProxyVerifyPage ? null : <ScrollRestoration />}
        {isProxyVerifyPage ? null : <Scripts />}
      </body>
    </html>
  );
}
