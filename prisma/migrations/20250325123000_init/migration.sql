CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "AuthItemStatus" AS ENUM (
  'CREATED',
  'ASSIGNED_TO_INVENTORY',
  'RESERVED',
  'SOLD',
  'CLAIM_PENDING',
  'CLAIMED',
  'TRANSFER_PENDING',
  'TRANSFERRED',
  'FLAGGED',
  'LOST',
  'STOLEN',
  'REFUNDED',
  'VOID'
);

CREATE TYPE "ClaimStatus" AS ENUM (
  'NOT_CLAIMED',
  'PENDING',
  'SECOND_FACTOR_REQUIRED',
  'VERIFIED',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
  'LOCKED'
);

CREATE TYPE "RiskState" AS ENUM (
  'CLEAR',
  'WATCH',
  'REVIEW',
  'LOCKED',
  'HARD_LOCK'
);

CREATE TYPE "TransferStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
  'REJECTED'
);

CREATE TYPE "VerifyResult" AS ENUM (
  'AUTHENTICATED',
  'ALREADY_REGISTERED',
  'REGISTERED_TO_CURRENT_USER',
  'OWNERSHIP_MISMATCH',
  'CLAIM_AVAILABLE',
  'FLAGGED_FOR_REVIEW',
  'INVALID_TOKEN',
  'EXPIRED_TRANSFER',
  'LOCKED'
);

CREATE TYPE "ClaimMethod" AS ENUM (
  'QR_ONLY',
  'QR_PLUS_CODE',
  'ORDER_SYNC',
  'MANUAL_OVERRIDE'
);

CREATE TYPE "RiskSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "ScanSource" AS ENUM (
  'PUBLIC',
  'CUSTOMER',
  'ADMIN',
  'WEBHOOK'
);

CREATE TYPE "WebhookDeliveryState" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'IGNORED',
  'RETRYING'
);

CREATE TYPE "AuditActorType" AS ENUM (
  'SYSTEM',
  'MERCHANT',
  'CUSTOMER',
  'SHOPIFY',
  'WEBHOOK',
  'API'
);

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT FALSE,
  "scope" TEXT,
  "expires" TIMESTAMPTZ(3),
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" BOOLEAN NOT NULL DEFAULT FALSE,
  "locale" TEXT,
  "collaborator" BOOLEAN DEFAULT FALSE,
  "emailVerified" BOOLEAN DEFAULT FALSE,
  "refreshToken" TEXT,
  "refreshTokenExpires" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shops" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopifyShopDomain" TEXT NOT NULL,
  "displayName" TEXT,
  "ownerEmail" TEXT,
  "accessTokenEncrypted" TEXT,
  "installedAt" TIMESTAMPTZ(3),
  "uninstalledAt" TIMESTAMPTZ(3),
  "settings" JSONB NOT NULL,
  "primaryCurrency" TEXT,
  "timezone" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shops_shopifyShopDomain_key" ON "shops"("shopifyShopDomain");
CREATE INDEX "shops_installedAt_idx" ON "shops"("installedAt");
CREATE INDEX "shops_uninstalledAt_idx" ON "shops"("uninstalledAt");

CREATE TABLE "products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "shopifyProductId" BIGINT NOT NULL,
  "shopifyVariantId" BIGINT NOT NULL,
  "sku" TEXT,
  "title" TEXT NOT NULL,
  "variantTitle" TEXT,
  "handle" TEXT,
  "vendor" TEXT,
  "productType" TEXT,
  "imageUrl" TEXT,
  "metadata" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "products_shopId_shopifyVariantId_key" ON "products"("shopId", "shopifyVariantId");
CREATE INDEX "products_shopId_shopifyProductId_idx" ON "products"("shopId", "shopifyProductId");
CREATE INDEX "products_shopId_sku_idx" ON "products"("shopId", "sku");

CREATE TABLE "customers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "shopifyCustomerId" BIGINT NOT NULL,
  "email" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "phone" TEXT,
  "locale" TEXT,
  "verifiedEmail" BOOLEAN NOT NULL DEFAULT FALSE,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customers_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "customers_shopId_shopifyCustomerId_key" ON "customers"("shopId", "shopifyCustomerId");
CREATE INDEX "customers_shopId_email_idx" ON "customers"("shopId", "email");

CREATE TABLE "auth_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "ownerCustomerId" UUID,
  "authId" TEXT NOT NULL,
  "serialNumber" TEXT NOT NULL,
  "qrTokenHash" TEXT NOT NULL,
  "qrTokenLast4" TEXT NOT NULL,
  "status" "AuthItemStatus" NOT NULL DEFAULT 'ASSIGNED_TO_INVENTORY',
  "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'NOT_CLAIMED',
  "riskState" "RiskState" NOT NULL DEFAULT 'CLEAR',
  "shopifyOrderId" BIGINT,
  "shopifyLineItemId" BIGINT,
  "shopifyFulfillmentId" BIGINT,
  "activatedAt" TIMESTAMPTZ(3),
  "claimedAt" TIMESTAMPTZ(3),
  "transferredAt" TIMESTAMPTZ(3),
  "lostAt" TIMESTAMPTZ(3),
  "stolenAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  "lockedAt" TIMESTAMPTZ(3),
  "lastScanAt" TIMESTAMPTZ(3),
  "claimSecondFactorEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_items_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "auth_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "auth_items_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "auth_items_qrTokenHash_key" ON "auth_items"("qrTokenHash");
CREATE UNIQUE INDEX "auth_items_shopId_authId_key" ON "auth_items"("shopId", "authId");
CREATE UNIQUE INDEX "auth_items_shopId_serialNumber_key" ON "auth_items"("shopId", "serialNumber");
CREATE INDEX "auth_items_shopId_status_idx" ON "auth_items"("shopId", "status");
CREATE INDEX "auth_items_shopId_claimStatus_idx" ON "auth_items"("shopId", "claimStatus");
CREATE INDEX "auth_items_shopId_ownerCustomerId_idx" ON "auth_items"("shopId", "ownerCustomerId");
CREATE INDEX "auth_items_shopId_productId_idx" ON "auth_items"("shopId", "productId");
CREATE INDEX "auth_items_shopifyOrderId_idx" ON "auth_items"("shopifyOrderId");

CREATE TABLE "scans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "authItemId" UUID NOT NULL,
  "verifyResult" "VerifyResult" NOT NULL,
  "source" "ScanSource" NOT NULL DEFAULT 'PUBLIC',
  "ipAddress" TEXT,
  "countryCode" TEXT,
  "deviceType" TEXT,
  "userAgent" TEXT,
  "isSuspicious" BOOLEAN NOT NULL DEFAULT FALSE,
  "suspiciousReason" TEXT,
  "tokenLast4" TEXT,
  "metadata" JSONB NOT NULL,
  "scannedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "scans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scans_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scans_authItemId_fkey" FOREIGN KEY ("authItemId") REFERENCES "auth_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "scans_shopId_authItemId_scannedAt_idx" ON "scans"("shopId", "authItemId", "scannedAt");
CREATE INDEX "scans_shopId_verifyResult_idx" ON "scans"("shopId", "verifyResult");

CREATE TABLE "claims" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "authItemId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
  "method" "ClaimMethod" NOT NULL DEFAULT 'QR_PLUS_CODE',
  "claimSecondFactorHash" TEXT,
  "claimSecondFactorLast4" TEXT,
  "claimSecondFactorExpiresAt" TIMESTAMPTZ(3),
  "verificationPayload" JSONB NOT NULL,
  "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "rejectedAt" TIMESTAMPTZ(3),
  "rejectReason" TEXT,
  "riskState" "RiskState" NOT NULL DEFAULT 'CLEAR',

  CONSTRAINT "claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "claims_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "claims_authItemId_fkey" FOREIGN KEY ("authItemId") REFERENCES "auth_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "claims_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "claims_shopId_authItemId_idx" ON "claims"("shopId", "authItemId");
CREATE INDEX "claims_shopId_customerId_idx" ON "claims"("shopId", "customerId");
CREATE INDEX "claims_shopId_status_idx" ON "claims"("shopId", "status");

CREATE TABLE "transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "authItemId" UUID NOT NULL,
  "fromCustomerId" UUID NOT NULL,
  "toCustomerId" UUID,
  "transferCodeHash" TEXT NOT NULL,
  "transferCodeLast4" TEXT NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "acceptedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transfers_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transfers_authItemId_fkey" FOREIGN KEY ("authItemId") REFERENCES "auth_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transfers_fromCustomerId_fkey" FOREIGN KEY ("fromCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "transfers_toCustomerId_fkey" FOREIGN KEY ("toCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "transfers_transferCodeHash_key" ON "transfers"("transferCodeHash");
CREATE INDEX "transfers_shopId_authItemId_idx" ON "transfers"("shopId", "authItemId");
CREATE INDEX "transfers_shopId_status_idx" ON "transfers"("shopId", "status");
CREATE INDEX "transfers_shopId_fromCustomerId_idx" ON "transfers"("shopId", "fromCustomerId");

CREATE TABLE "risk_flags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "authItemId" UUID,
  "scanId" UUID,
  "claimId" UUID,
  "transferId" UUID,
  "severity" "RiskSeverity" NOT NULL DEFAULT 'MEDIUM',
  "code" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "state" "RiskState" NOT NULL DEFAULT 'WATCH',
  "metadata" JSONB NOT NULL,
  "acknowledgedAt" TIMESTAMPTZ(3),
  "resolvedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "risk_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "risk_flags_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "risk_flags_authItemId_fkey" FOREIGN KEY ("authItemId") REFERENCES "auth_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "risk_flags_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "risk_flags_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "risk_flags_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "risk_flags_shopId_state_idx" ON "risk_flags"("shopId", "state");
CREATE INDEX "risk_flags_shopId_authItemId_idx" ON "risk_flags"("shopId", "authItemId");
CREATE INDEX "risk_flags_code_idx" ON "risk_flags"("code");

CREATE TABLE "webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "topic" TEXT NOT NULL,
  "webhookId" TEXT NOT NULL,
  "deliveryState" "WebhookDeliveryState" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "headers" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webhook_events_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "webhook_events_webhookId_key" ON "webhook_events"("webhookId");
CREATE INDEX "webhook_events_shopId_topic_idx" ON "webhook_events"("shopId", "topic");
CREATE INDEX "webhook_events_shopId_deliveryState_idx" ON "webhook_events"("shopId", "deliveryState");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shopId" UUID NOT NULL,
  "actorType" "AuditActorType" NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "payload" JSONB NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "audit_logs_shopId_entityType_entityId_idx" ON "audit_logs"("shopId", "entityType", "entityId");
CREATE INDEX "audit_logs_shopId_action_idx" ON "audit_logs"("shopId", "action");
CREATE INDEX "audit_logs_shopId_createdAt_idx" ON "audit_logs"("shopId", "createdAt");
