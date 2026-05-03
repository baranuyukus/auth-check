declare module "*.css";
declare module "react-dom/server.browser" {
  export * from "react-dom/server";
  export function renderToReadableStream(
    children: React.ReactNode,
    options?: {
      signal?: AbortSignal;
      onError?: (error: unknown) => void;
      [key: string]: unknown;
    },
  ): Promise<ReadableStream<Uint8Array> & { allReady?: Promise<void> }>;
}
