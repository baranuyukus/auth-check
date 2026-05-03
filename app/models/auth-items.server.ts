import {
  AuditActorType,
  AuthItemStatus,
  ClaimMethod,
  ClaimStatus,
  Prisma,
  RiskSeverity,
  RiskState,
  ScanSource,
  TransferStatus,
  VerifyResult,
} from "@prisma/client";
import prisma from "../db.server";
import {
  buildAuthId,
  buildBatchReference,
  buildSerialNumber,
} from "../lib/auth-identifiers.server";
import {
  buildNumericCode,
  buildOpaqueToken,
  hashOpaqueValue,
  safeLast4,
  verifyOpaqueValue,
} from "../lib/crypto.server";
import { asJson } from "../lib/prisma-json.server";
import { getRequestContext } from "../lib/request-context.server";

export function formatDate(value?: Date | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value);
}

function buildVerifyUrl(params: {
  shopDomain: string;
  verifyPath: string;
  token: string;
}) {
  const normalizedPath = params.verifyPath.startsWith("/")
    ? params.verifyPath
    : `/${params.verifyPath}`;

  return `https://${params.shopDomain}${normalizedPath}/${encodeURIComponent(params.token)}`;
}

function serializeAuthItemRecord(
  authItem: Prisma.AuthItemGetPayload<{
    include: {
      product: true;
      ownerCustomer: true;
    };
  }>,
) {
  const metadata =
    authItem.metadata && typeof authItem.metadata === "object"
      ? (authItem.metadata as Record<string, unknown>)
      : {};

  return {
    id: authItem.id,
    authId: authItem.authId,
    serialNumber: authItem.serialNumber,
    status: authItem.status,
    claimStatus: authItem.claimStatus,
    riskState: authItem.riskState,
    qrTokenLast4: authItem.qrTokenLast4,
    createdAt: formatDate(authItem.createdAt),
    activatedAt: formatDate(authItem.activatedAt),
    lastScanAt: formatDate(authItem.lastScanAt),
    productTitle: authItem.product.title,
    variantTitle: authItem.product.variantTitle ?? "Default variant",
    imageUrl:
      authItem.product.imageUrl ||
      (typeof metadata.imageUrl === "string" ? metadata.imageUrl : null),
    ownerName: authItem.ownerCustomer
      ? [authItem.ownerCustomer.firstName, authItem.ownerCustomer.lastName]
          .filter(Boolean)
          .join(" ") || authItem.ownerCustomer.email
      : "Unassigned",
  };
}

export async function getDashboardSnapshot(shopId: string) {
  const [
    totalAuthItems,
    claimedItems,
    pendingClaims,
    flaggedItems,
    recentScans,
    recentTransfers,
  ] = await prisma.$transaction([
    prisma.authItem.count({ where: { shopId } }),
    prisma.authItem.count({
      where: {
        shopId,
        OR: [{ status: AuthItemStatus.CLAIMED }, { ownerCustomerId: { not: null } }],
      },
    }),
    prisma.claim.count({
      where: { shopId, status: { in: [ClaimStatus.PENDING, ClaimStatus.VERIFIED] } },
    }),
    prisma.riskFlag.count({
      where: {
        shopId,
        state: { in: [RiskState.WATCH, RiskState.REVIEW, RiskState.LOCKED, RiskState.HARD_LOCK] },
      },
    }),
    prisma.scan.findMany({
      where: { shopId },
      include: {
        authItem: {
          include: { product: true },
        },
      },
      orderBy: { scannedAt: "desc" },
      take: 6,
    }),
    prisma.transfer.findMany({
      where: { shopId },
      include: {
        authItem: true,
        fromCustomer: true,
        toCustomer: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return {
    metrics: {
      totalAuthItems,
      claimedItems,
      pendingClaims,
      flaggedItems,
    },
    recentScans: recentScans.map((scan) => ({
      id: scan.id,
      authId: scan.authItem.authId,
      productTitle: scan.authItem.product.title,
      result: scan.verifyResult,
      countryCode: scan.countryCode ?? "Unknown",
      scannedAt: formatDate(scan.scannedAt),
    })),
    recentTransfers: recentTransfers.map((transfer) => ({
      id: transfer.id,
      authItemId: transfer.authItem.authId,
      status: transfer.status,
      fromCustomer:
        transfer.fromCustomer.email ||
        [transfer.fromCustomer.firstName, transfer.fromCustomer.lastName]
          .filter(Boolean)
          .join(" "),
      toCustomer:
        transfer.toCustomer?.email ||
        [transfer.toCustomer?.firstName, transfer.toCustomer?.lastName]
          .filter(Boolean)
          .join(" ") ||
        "Pending recipient",
      expiresAt: formatDate(transfer.expiresAt),
    })),
  };
}

export async function listProducts(shopId: string) {
  const products = await prisma.product.findMany({
    where: { shopId },
    include: {
      _count: {
        select: { authItems: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return products.map((product) => ({
    id: product.id,
    title: product.title,
    variantTitle: product.variantTitle ?? "Default variant",
    sku: product.sku ?? "No SKU",
    authItemsCount: product._count.authItems,
    updatedAt: formatDate(product.updatedAt),
  }));
}

export async function listAuthItems(shopId: string) {
  const authItems = await prisma.authItem.findMany({
    where: { shopId },
    include: {
      product: true,
      ownerCustomer: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return authItems.map(serializeAuthItemRecord);
}

export async function getAuthItemDetail(shopId: string, authItemId: string) {
  const authItem = await prisma.authItem.findFirst({
    where: { shopId, id: authItemId },
    include: {
      product: true,
      ownerCustomer: true,
      scans: {
        orderBy: { scannedAt: "desc" },
        take: 12,
      },
      claims: {
        include: { customer: true },
        orderBy: { requestedAt: "desc" },
        take: 8,
      },
      transfers: {
        include: {
          fromCustomer: true,
          toCustomer: true,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      riskFlags: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });

  if (!authItem) {
    return null;
  }

  return {
    item: serializeAuthItemRecord(authItem),
    scans: authItem.scans.map((scan) => ({
      id: scan.id,
      result: scan.verifyResult,
      countryCode: scan.countryCode ?? "Unknown",
      deviceType: scan.deviceType ?? "Unknown",
      suspiciousReason: scan.suspiciousReason ?? "",
      scannedAt: formatDate(scan.scannedAt),
    })),
    claims: authItem.claims.map((claim) => ({
      id: claim.id,
      status: claim.status,
      method: claim.method,
      customer:
        claim.customer.email ||
        [claim.customer.firstName, claim.customer.lastName]
          .filter(Boolean)
          .join(" "),
      requestedAt: formatDate(claim.requestedAt),
      completedAt: formatDate(claim.completedAt),
    })),
    transfers: authItem.transfers.map((transfer) => ({
      id: transfer.id,
      status: transfer.status,
      fromCustomer:
        transfer.fromCustomer.email ||
        [transfer.fromCustomer.firstName, transfer.fromCustomer.lastName]
          .filter(Boolean)
          .join(" "),
      toCustomer:
        transfer.toCustomer?.email ||
        [transfer.toCustomer?.firstName, transfer.toCustomer?.lastName]
          .filter(Boolean)
          .join(" ") ||
        "Pending recipient",
      expiresAt: formatDate(transfer.expiresAt),
      completedAt: formatDate(transfer.completedAt),
    })),
    flags: authItem.riskFlags.map((flag) => ({
      id: flag.id,
      code: flag.code,
      severity: flag.severity,
      state: flag.state,
      createdAt: formatDate(flag.createdAt),
      reason: flag.reason,
    })),
  };
}

export async function listTransfers(shopId: string) {
  const transfers = await prisma.transfer.findMany({
    where: { shopId },
    include: {
      authItem: true,
      fromCustomer: true,
      toCustomer: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return transfers.map((transfer) => ({
    id: transfer.id,
    authId: transfer.authItem.authId,
    status: transfer.status,
    expiresAt: formatDate(transfer.expiresAt),
    createdAt: formatDate(transfer.createdAt),
    fromCustomer:
      transfer.fromCustomer.email ||
      [transfer.fromCustomer.firstName, transfer.fromCustomer.lastName]
        .filter(Boolean)
        .join(" "),
    toCustomer:
      transfer.toCustomer?.email ||
      [transfer.toCustomer?.firstName, transfer.toCustomer?.lastName]
        .filter(Boolean)
        .join(" ") ||
      "Pending recipient",
  }));
}

export async function listScanLogs(shopId: string) {
  const scans = await prisma.scan.findMany({
    where: { shopId },
    include: {
      authItem: true,
    },
    orderBy: { scannedAt: "desc" },
    take: 150,
  });

  return scans.map((scan) => ({
    id: scan.id,
    authId: scan.authItem.authId,
    result: scan.verifyResult,
    countryCode: scan.countryCode ?? "Unknown",
    deviceType: scan.deviceType ?? "Unknown",
    suspicious: scan.isSuspicious,
    reason: scan.suspiciousReason ?? "",
    scannedAt: formatDate(scan.scannedAt),
  }));
}

export async function listRiskFlags(shopId: string) {
  const flags = await prisma.riskFlag.findMany({
    where: { shopId },
    include: {
      authItem: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return flags.map((flag) => ({
    id: flag.id,
    authId: flag.authItem?.authId ?? "Unknown item",
    code: flag.code,
    severity: flag.severity,
    state: flag.state,
    reason: flag.reason,
    createdAt: formatDate(flag.createdAt),
  }));
}

export async function createAuthItemBatch(params: {
  shopId: string;
  shopDomain: string;
  productId: string;
  quantity: number;
  actorId: string;
  verifyPath: string;
}) {
  const { shopId, shopDomain, productId, quantity, actorId, verifyPath } = params;

  const product = await prisma.product.findFirst({
    where: { shopId, id: productId },
  });

  if (!product) {
    throw new Error("Product not found for batch generation.");
  }

  const currentCount = await prisma.authItem.count({ where: { shopId } });
  const batchReference = buildBatchReference();
  const createdAt = new Date();

  const batchPreview: Array<{
    authId: string;
    serialNumber: string;
    rawToken: string;
    claimCode: string;
    verifyUrl: string;
    qrTokenLast4: string;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < quantity; index += 1) {
      const sequence = currentCount + index + 1;
      const rawToken = buildOpaqueToken();
      const claimCode = buildNumericCode();
      const authId = buildAuthId(sequence, createdAt);
      const serialNumber = buildSerialNumber(sequence);
      const qrTokenHash = hashOpaqueValue(rawToken);
      const qrTokenLast4 = safeLast4(rawToken);

      await tx.authItem.create({
        data: {
          shopId,
          productId,
          authId,
          serialNumber,
          qrTokenHash,
          qrTokenLast4,
          status: AuthItemStatus.ASSIGNED_TO_INVENTORY,
          claimStatus: ClaimStatus.NOT_CLAIMED,
          riskState: RiskState.CLEAR,
          metadata: {
            batchReference,
            claimCodeHash: hashOpaqueValue(claimCode),
            claimCodeLast4: safeLast4(claimCode),
            imageUrl: product.imageUrl,
          },
        },
      });

      batchPreview.push({
        authId,
        serialNumber,
        rawToken,
        claimCode,
        verifyUrl: buildVerifyUrl({
          shopDomain,
          verifyPath,
          token: rawToken,
        }),
        qrTokenLast4,
      });
    }

    await tx.auditLog.create({
      data: {
        shopId,
        actorType: AuditActorType.MERCHANT,
        actorId,
        action: "auth_items.batch_created",
        entityType: "batch",
        entityId: batchReference,
        payload: {
          batchReference,
          productId,
          quantity,
        },
      },
    });
  });

  return {
    batchReference,
    product,
    items: batchPreview,
  };
}

export async function startTransfer(params: {
  shopId: string;
  authItemId: string;
  fromCustomerId: string;
  actorId: string;
}) {
  const transferCode = buildNumericCode(10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const transfer = await prisma.transfer.create({
    data: {
      shopId: params.shopId,
      authItemId: params.authItemId,
      fromCustomerId: params.fromCustomerId,
      transferCodeHash: hashOpaqueValue(transferCode),
      transferCodeLast4: safeLast4(transferCode),
      status: TransferStatus.ACTIVE,
      expiresAt,
      metadata: {
        initiatedBy: params.actorId,
      },
    },
  });

  await prisma.authItem.update({
    where: { id: params.authItemId },
    data: {
      status: AuthItemStatus.TRANSFER_PENDING,
      transferredAt: new Date(),
    },
  });

  return {
    transferId: transfer.id,
    transferCode,
    expiresAt,
  };
}

export async function acceptTransfer(params: {
  shopId: string;
  authItemId: string;
  customerId: string;
  transferCode: string;
}) {
  const activeTransfer = await prisma.transfer.findFirst({
    where: {
      shopId: params.shopId,
      authItemId: params.authItemId,
      status: TransferStatus.ACTIVE,
    },
  });

  if (!activeTransfer) {
    throw new Error("Active transfer not found.");
  }

  if (activeTransfer.expiresAt.getTime() < Date.now()) {
    throw new Error("Transfer code has expired.");
  }

  if (!verifyOpaqueValue(params.transferCode, activeTransfer.transferCodeHash)) {
    throw new Error("Transfer code is invalid.");
  }

  await prisma.$transaction([
    prisma.transfer.update({
      where: { id: activeTransfer.id },
      data: {
        status: TransferStatus.COMPLETED,
        toCustomerId: params.customerId,
        acceptedAt: new Date(),
        completedAt: new Date(),
      },
    }),
    prisma.authItem.update({
      where: { id: params.authItemId },
      data: {
        ownerCustomerId: params.customerId,
        status: AuthItemStatus.TRANSFERRED,
        transferredAt: new Date(),
      },
    }),
  ]);

  return { ok: true };
}

export async function claimAuthItem(params: {
  shopId: string;
  authItemId: string;
  customerId: string;
  claimCode: string;
}) {
  const authItem = await prisma.authItem.findFirst({
    where: { shopId: params.shopId, id: params.authItemId },
  });

  if (!authItem) {
    throw new Error("Auth item not found.");
  }

  if (authItem.ownerCustomerId || authItem.claimStatus === ClaimStatus.COMPLETED) {
    throw new Error("This item is already registered and cannot be claimed again.");
  }

  const metadata =
    authItem.metadata && typeof authItem.metadata === "object"
      ? (authItem.metadata as Record<string, unknown>)
      : {};
  const expectedHash =
    typeof metadata.claimCodeHash === "string" ? metadata.claimCodeHash : null;

  if (!expectedHash || !verifyOpaqueValue(params.claimCode, expectedHash)) {
    throw new Error("Claim code is invalid.");
  }

  await prisma.$transaction(async (tx) => {
    const claimedAt = new Date();
    const lockedClaim = await tx.authItem.updateMany({
      where: {
        id: authItem.id,
        shopId: params.shopId,
        ownerCustomerId: null,
        claimStatus: {
          not: ClaimStatus.COMPLETED,
        },
      },
      data: {
        ownerCustomerId: params.customerId,
        status: AuthItemStatus.CLAIMED,
        claimStatus: ClaimStatus.COMPLETED,
        claimedAt,
      },
    });

    if (lockedClaim.count !== 1) {
      throw new Error("This item is already registered and cannot be claimed again.");
    }

    const claim = await tx.claim.create({
      data: {
        shopId: params.shopId,
        authItemId: params.authItemId,
        customerId: params.customerId,
        status: ClaimStatus.COMPLETED,
        method: ClaimMethod.QR_PLUS_CODE,
        claimSecondFactorHash: expectedHash,
        claimSecondFactorLast4: safeLast4(params.claimCode),
        verifiedAt: claimedAt,
        completedAt: claimedAt,
        verificationPayload: {
          mode: "manual-claim",
        },
      },
    });

    await tx.auditLog.create({
      data: {
        shopId: params.shopId,
        actorType: AuditActorType.CUSTOMER,
        actorId: params.customerId,
        action: "claim.completed",
        entityType: "claim",
        entityId: claim.id,
        payload: {
          authItemId: params.authItemId,
        },
      },
    });
  });

  return { ok: true };
}

export async function reserveAuthItemsForOrder(params: {
  shopId: string;
  order: Record<string, unknown>;
}) {
  const lineItems = Array.isArray(params.order.line_items)
    ? (params.order.line_items as Array<Record<string, unknown>>)
    : [];
  const customer =
    params.order.customer && typeof params.order.customer === "object"
      ? (params.order.customer as Record<string, unknown>)
      : null;

  let customerId: string | null = null;

  if (customer && typeof customer.id === "number") {
    const upsertedCustomer = await prisma.customer.upsert({
      where: {
        shopId_shopifyCustomerId: {
          shopId: params.shopId,
          shopifyCustomerId: BigInt(customer.id),
        },
      },
      update: {
        email: typeof customer.email === "string" ? customer.email : null,
        firstName:
          typeof customer.first_name === "string" ? customer.first_name : null,
        lastName:
          typeof customer.last_name === "string" ? customer.last_name : null,
        metadata: asJson(customer),
      },
      create: {
        shopId: params.shopId,
        shopifyCustomerId: BigInt(customer.id),
        email: typeof customer.email === "string" ? customer.email : null,
        firstName:
          typeof customer.first_name === "string" ? customer.first_name : null,
        lastName:
          typeof customer.last_name === "string" ? customer.last_name : null,
        metadata: asJson(customer),
      },
    });

    customerId = upsertedCustomer.id;
  }

  for (const lineItem of lineItems) {
    if (typeof lineItem.variant_id !== "number") {
      continue;
    }

    const product = await prisma.product.findUnique({
      where: {
        shopId_shopifyVariantId: {
          shopId: params.shopId,
          shopifyVariantId: BigInt(lineItem.variant_id),
        },
      },
    });

    if (!product) {
      continue;
    }

    const quantity = typeof lineItem.quantity === "number" ? lineItem.quantity : 1;
    const availableItems = await prisma.authItem.findMany({
      where: {
        shopId: params.shopId,
        productId: product.id,
        status: {
          in: [AuthItemStatus.CREATED, AuthItemStatus.ASSIGNED_TO_INVENTORY],
        },
      },
      orderBy: { createdAt: "asc" },
      take: quantity,
    });

    await prisma.$transaction(
      availableItems.map((authItem) =>
        prisma.authItem.update({
          where: { id: authItem.id },
          data: {
            ownerCustomerId: customerId,
            status: AuthItemStatus.RESERVED,
            claimStatus: ClaimStatus.PENDING,
            shopifyOrderId:
              typeof params.order.id === "number" ? BigInt(params.order.id) : null,
            shopifyLineItemId:
              typeof lineItem.id === "number" ? BigInt(lineItem.id) : null,
          },
        }),
      ),
    );
  }
}

export async function activateReservedAuthItemsFromFulfillment(params: {
  shopId: string;
  fulfillment: Record<string, unknown>;
}) {
  const lineItems = Array.isArray(params.fulfillment.line_items)
    ? (params.fulfillment.line_items as Array<Record<string, unknown>>)
    : [];

  for (const lineItem of lineItems) {
    if (typeof lineItem.id !== "number") {
      continue;
    }

    const items = await prisma.authItem.findMany({
      where: {
        shopId: params.shopId,
        shopifyLineItemId: BigInt(lineItem.id),
        status: AuthItemStatus.RESERVED,
      },
    });

    await prisma.$transaction(
      items.map((authItem) =>
        prisma.authItem.update({
          where: { id: authItem.id },
          data: {
            status: AuthItemStatus.CLAIMED,
            claimStatus: ClaimStatus.COMPLETED,
            activatedAt: new Date(),
            claimedAt: authItem.claimedAt ?? new Date(),
            shopifyFulfillmentId:
              typeof params.fulfillment.id === "number"
                ? BigInt(params.fulfillment.id)
                : null,
          },
        }),
      ),
    );
  }
}

export async function cancelReservedAuthItems(params: {
  shopId: string;
  orderId?: number;
}) {
  if (!params.orderId) {
    return;
  }

  await prisma.authItem.updateMany({
    where: {
      shopId: params.shopId,
      shopifyOrderId: BigInt(params.orderId),
      status: { in: [AuthItemStatus.RESERVED, AuthItemStatus.CLAIMED] },
    },
    data: {
      ownerCustomerId: null,
      status: AuthItemStatus.REFUNDED,
      claimStatus: ClaimStatus.CANCELLED,
      revokedAt: new Date(),
    },
  });
}

export async function verifyPublicAuthToken(params: {
  shopId: string;
  token: string;
  loggedInCustomerId?: string | null;
  request: Request;
}) {
  const requestContext = getRequestContext(params.request);
  const qrTokenHash = hashOpaqueValue(params.token);
  const authItem = await prisma.authItem.findUnique({
    where: { qrTokenHash },
    include: {
      product: true,
      ownerCustomer: true,
      scans: {
        orderBy: { scannedAt: "desc" },
        take: 1,
      },
      riskFlags: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      shop: true,
    },
  });

  if (!authItem || authItem.shopId !== params.shopId) {
    await prisma.auditLog.create({
      data: {
        shopId: params.shopId,
        actorType: AuditActorType.API,
        actorId: "public-verify",
        action: "verify.invalid_token",
        entityType: "auth_item",
        payload: {
          tokenLast4: safeLast4(params.token),
        },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      },
    });

    return {
      result: VerifyResult.INVALID_TOKEN,
      statusLabel: "Invalid Token",
      authItem: null,
      ownerState: "No matching authenticity item was found for this code.",
      riskNotes: [],
    };
  }

  let result: VerifyResult = VerifyResult.AUTHENTICATED;
  const ownerMatches =
    params.loggedInCustomerId &&
    authItem.ownerCustomer?.shopifyCustomerId.toString() === params.loggedInCustomerId;

  if (authItem.riskState === RiskState.LOCKED || authItem.riskState === RiskState.HARD_LOCK) {
    result = VerifyResult.LOCKED;
  } else if (
    authItem.status === AuthItemStatus.FLAGGED ||
    authItem.riskState === RiskState.REVIEW
  ) {
    result = VerifyResult.FLAGGED_FOR_REVIEW;
  } else if (ownerMatches) {
    result = VerifyResult.REGISTERED_TO_CURRENT_USER;
  } else if (params.loggedInCustomerId && authItem.ownerCustomerId) {
    result = VerifyResult.OWNERSHIP_MISMATCH;
  } else if (!authItem.ownerCustomerId) {
    result = VerifyResult.CLAIM_AVAILABLE;
  } else {
    result = VerifyResult.ALREADY_REGISTERED;
  }

  const previousScan = authItem.scans[0];
  const suspicious =
    !!previousScan &&
    !!previousScan.countryCode &&
    !!requestContext.countryCode &&
    previousScan.countryCode !== requestContext.countryCode;
  const suspiciousReason = suspicious
    ? `Country changed from ${previousScan.countryCode} to ${requestContext.countryCode}`
    : null;

  const scan = await prisma.scan.create({
    data: {
      shopId: params.shopId,
      authItemId: authItem.id,
      verifyResult: result,
      source: ScanSource.PUBLIC,
      ipAddress: requestContext.ipAddress,
      countryCode: requestContext.countryCode,
      deviceType: requestContext.deviceType,
      userAgent: requestContext.userAgent,
      isSuspicious: suspicious,
      suspiciousReason,
      tokenLast4: authItem.qrTokenLast4,
      metadata: asJson({
        loggedInCustomerId: params.loggedInCustomerId ?? null,
      }),
    },
  });

  await prisma.authItem.update({
    where: { id: authItem.id },
    data: {
      lastScanAt: scan.scannedAt,
      riskState: suspicious ? RiskState.WATCH : authItem.riskState,
    },
  });

  if (suspicious && suspiciousReason) {
    await prisma.riskFlag.create({
      data: {
        shopId: params.shopId,
        authItemId: authItem.id,
        scanId: scan.id,
        severity: RiskSeverity.MEDIUM,
        code: "COUNTRY_HOPPING",
        reason: suspiciousReason,
        state: RiskState.WATCH,
        metadata: asJson({
          previousCountry: previousScan?.countryCode ?? null,
          currentCountry: requestContext.countryCode,
        }),
      },
    });
  }

  return {
    result,
    statusLabel: result.replaceAll("_", " "),
    authItem: {
      authId: authItem.authId,
      productTitle: authItem.product.title,
      variantTitle: authItem.product.variantTitle ?? "Default variant",
      imageUrl: authItem.product.imageUrl || "/hoodie-navy.jpg",
      activatedAt: formatDate(authItem.activatedAt),
      createdAt: formatDate(authItem.createdAt),
      qrTokenLast4: authItem.qrTokenLast4,
      ownerState: authItem.ownerCustomerId ? "Owner registered" : "Claim available",
    },
    ownerState:
      result === VerifyResult.REGISTERED_TO_CURRENT_USER
        ? "This item is already registered to your account."
        : authItem.ownerCustomerId
          ? "This item is registered in the ownership registry."
          : "This item is authentic and available to be claimed by its owner.",
    riskNotes: authItem.riskFlags.map((flag) => flag.reason),
  };
}
