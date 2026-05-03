import { createRequestHandler, type ServerBuild } from "react-router";

type HyperdriveBinding = {
  connectionString: string;
};

type CloudflareBindings = Record<string, unknown> & {
  HYPERDRIVE_CONNECTION_STRING?: string;
  HYPERDRIVE?: HyperdriveBinding;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SCOPES?: string;
  SHOPIFY_APP_URL?: string;
  SHOP_CUSTOM_DOMAIN?: string;
  APP_BRIDGE_URL?: string;
};

let requestHandlerPromise: Promise<ReturnType<typeof createRequestHandler>> | null = null;

function populateProcessEnv(env: CloudflareBindings) {
  const envKeys = [
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SCOPES",
    "SHOPIFY_APP_URL",
    "SHOP_CUSTOM_DOMAIN",
    "DATABASE_URL",
    "DIRECT_URL",
    "APP_BRIDGE_URL",
  ] as const;

  for (const key of envKeys) {
    const value = env[key];

    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }

  if (env.HYPERDRIVE?.connectionString) {
    process.env.HYPERDRIVE_CONNECTION_STRING = env.HYPERDRIVE.connectionString;
  } else if (env.HYPERDRIVE_CONNECTION_STRING) {
    process.env.HYPERDRIVE_CONNECTION_STRING = env.HYPERDRIVE_CONNECTION_STRING;
  }
}

async function getRequestHandler(env: CloudflareBindings) {
  populateProcessEnv(env);

  if (!requestHandlerPromise) {
    requestHandlerPromise = import("./server-build").then(({ default: serverBuild }) =>
      createRequestHandler(
        () => Promise.resolve(serverBuild as unknown as ServerBuild),
        process.env.NODE_ENV ?? "production",
      ),
    );
  }

  return requestHandlerPromise;
}

const worker = {
  async fetch(request: Request, env: CloudflareBindings, ctx: unknown) {
    const cloudflareRequest = request as Request & { cf?: unknown };
    const requestHandler = await getRequestHandler(env);

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
