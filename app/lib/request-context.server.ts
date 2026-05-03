export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  countryCode: string | null;
  deviceType: string;
};

function inferDeviceType(userAgent: string | null) {
  if (!userAgent) return "unknown";
  const source = userAgent.toLowerCase();

  if (source.includes("mobile")) return "mobile";
  if (source.includes("tablet") || source.includes("ipad")) return "tablet";

  return "desktop";
}

export function getRequestContext(request: Request): RequestContext {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");
  const countryCode =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    null;

  return {
    ipAddress,
    userAgent,
    countryCode,
    deviceType: inferDeviceType(userAgent),
  };
}
