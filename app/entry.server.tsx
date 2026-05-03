import { renderToReadableStream } from "react-dom/server.browser";
import { ServerRouter } from "react-router";
import { type EntryContext } from "react-router";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext
) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  }

  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const waitForAllReady = isbot(userAgent ?? "") || reactRouterContext.isSpaMode;

  let shellRendered = false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), streamTimeout + 1000);

  try {
    const body = await renderToReadableStream(
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
      />,
      {
        signal: controller.signal,
        onError(error: unknown) {
          responseStatusCode = 500;

          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    shellRendered = true;

    if (waitForAllReady) {
      await body.allReady;
    }

    responseHeaders.set("Content-Type", "text/html");

    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
