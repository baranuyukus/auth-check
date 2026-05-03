import { createRequestHandler } from "react-router";

type CloudflareBindings = Record<string, unknown> & {
  HYPERDRIVE_CONNECTION_STRING?: string;
};

const serverBuildModuleId = "../build/server/index.js";

const requestHandler = createRequestHandler(
  () => import(serverBuildModuleId),
  typeof process !== "undefined" ? process.env.NODE_ENV ?? "production" : "production",
);

const worker = {
  async fetch(request: Request, env: CloudflareBindings, ctx: unknown) {
    const cloudflareRequest = request as Request & { cf?: unknown };

    return requestHandler(request, {
      cloudflare: {
        env,
        ctx,
        cf: cloudflareRequest.cf,
        caches,
      },
    });
  },
};

export default worker;
