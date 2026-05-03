import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function makeToken(raw: string) {
  return {
    raw,
    hash: hash(raw),
    last4: raw.slice(-4),
  }
}

async function main() {
  const authToken = makeToken('meezy-seed-qr-token-0001')
  const transferToken = makeToken('meezy-seed-transfer-token-0001')

  const shop = await prisma.shop.upsert({
    where: { shopifyShopDomain: 'meezy-archive.myshopify.com' },
    update: {
      displayName: 'Meezy Archive',
      ownerEmail: 'studio@meezyarchive.com',
      accessTokenEncrypted: 'seed-encrypted-token',
      installedAt: new Date(),
      settings: {
        brandName: 'Meezy Archive',
        mode: 'single-brand-demo',
        verificationPath: '/a/verify',
      },
      primaryCurrency: 'USD',
      timezone: 'America/New_York',
    },
    create: {
      shopifyShopDomain: 'meezy-archive.myshopify.com',
      displayName: 'Meezy Archive',
      ownerEmail: 'studio@meezyarchive.com',
      accessTokenEncrypted: 'seed-encrypted-token',
      installedAt: new Date(),
      settings: {
        brandName: 'Meezy Archive',
        mode: 'single-brand-demo',
        verificationPath: '/a/verify',
      },
      primaryCurrency: 'USD',
      timezone: 'America/New_York',
    },
  })

  const product = await prisma.product.upsert({
    where: {
      shopId_shopifyVariantId: {
        shopId: shop.id,
        shopifyVariantId: BigInt('1234567890123'),
      },
    },
    update: {
      title: 'Denim Tears Mono Cotton Wreath Hoodie',
      variantTitle: 'Navy On Navy / M',
    },
    create: {
      shopId: shop.id,
      shopifyProductId: BigInt('9876543210987'),
      shopifyVariantId: BigInt('1234567890123'),
      sku: 'DT-MCW-HOODIE-NAVY-M',
      title: 'Denim Tears Mono Cotton Wreath Hoodie',
      variantTitle: 'Navy On Navy / M',
      handle: 'denim-tears-mono-cotton-wreath-hoodie',
      vendor: 'Denim Tears',
      productType: 'Hoodie',
      imageUrl: '/hoodie-navy.jpg',
      metadata: {
        color: 'Navy On Navy',
        size: 'M',
        collection: 'Archive',
      },
    },
  })

  const customer = await prisma.customer.upsert({
    where: {
      shopId_shopifyCustomerId: {
        shopId: shop.id,
        shopifyCustomerId: BigInt('555000111222'),
      },
    },
    update: {
      email: 'buyer@meezyarchive.com',
      firstName: 'Mia',
      lastName: 'Archive',
    },
    create: {
      shopId: shop.id,
      shopifyCustomerId: BigInt('555000111222'),
      email: 'buyer@meezyarchive.com',
      firstName: 'Mia',
      lastName: 'Archive',
      phone: '+1 212 555 0100',
      locale: 'en-US',
      verifiedEmail: true,
      metadata: {
        source: 'seed',
        segment: 'collector',
      },
    },
  })

  const authItem = await prisma.authItem.upsert({
    where: {
      shopId_authId: {
        shopId: shop.id,
        authId: 'MA-ATH-240325-0001',
      },
    },
    update: {
      ownerCustomerId: customer.id,
      status: 'CLAIMED',
      claimStatus: 'COMPLETED',
      riskState: 'WATCH',
      qrTokenHash: authToken.hash,
      qrTokenLast4: authToken.last4,
      claimedAt: new Date(),
      activatedAt: new Date(),
      metadata: {
        season: 'SS26',
        seed: true,
      },
    },
    create: {
      shopId: shop.id,
      productId: product.id,
      ownerCustomerId: customer.id,
      authId: 'MA-ATH-240325-0001',
      serialNumber: 'MEEZY-0001',
      qrTokenHash: authToken.hash,
      qrTokenLast4: authToken.last4,
      status: 'CLAIMED',
      claimStatus: 'COMPLETED',
      riskState: 'WATCH',
      shopifyOrderId: BigInt('900000000001'),
      shopifyLineItemId: BigInt('900000000101'),
      shopifyFulfillmentId: BigInt('900000000201'),
      activatedAt: new Date(),
      claimedAt: new Date(),
      claimSecondFactorEnabled: true,
      metadata: {
        source: 'seed',
        note: 'Demo authenticated item',
      },
    },
  })

  await prisma.scan.deleteMany({
    where: { authItemId: authItem.id },
  })

  const authenticatedScan = await prisma.scan.create({
    data: {
      shopId: shop.id,
      authItemId: authItem.id,
      verifyResult: 'AUTHENTICATED',
      source: 'PUBLIC',
      ipAddress: '203.0.113.10',
      countryCode: 'US',
      deviceType: 'mobile',
      userAgent: 'Mozilla/5.0 MeezyArchiveSeed',
      isSuspicious: false,
      tokenLast4: authToken.last4,
      metadata: {
        source: 'seed',
        scanType: 'happy-path',
      },
    },
  })

  const suspiciousScan = await prisma.scan.create({
    data: {
      shopId: shop.id,
      authItemId: authItem.id,
      verifyResult: 'FLAGGED_FOR_REVIEW',
      source: 'PUBLIC',
      ipAddress: '198.51.100.17',
      countryCode: 'DE',
      deviceType: 'desktop',
      userAgent: 'Mozilla/5.0 MeezyArchiveSeed',
      isSuspicious: true,
      suspiciousReason: 'Rapid multi-country scanning pattern',
      tokenLast4: authToken.last4,
      metadata: {
        source: 'seed',
        scanType: 'anomaly',
      },
    },
  })

  await prisma.riskFlag.deleteMany({
    where: { authItemId: authItem.id },
  })

  await prisma.riskFlag.create({
    data: {
      shopId: shop.id,
      authItemId: authItem.id,
      scanId: suspiciousScan.id,
      severity: 'HIGH',
      code: 'COUNTRY_HOPPING',
      reason: 'Two scans arrived from different countries within a short interval.',
      state: 'REVIEW',
      metadata: {
        seed: true,
        relatedScanIds: [authenticatedScan.id, suspiciousScan.id],
      },
    },
  })

  await prisma.auditLog.create({
    data: {
      shopId: shop.id,
      actorType: 'SYSTEM',
      actorId: 'seed-script',
      action: 'seed.completed',
      entityType: 'auth_item',
      entityId: authItem.id,
      payload: {
        authId: authItem.authId,
        serialNumber: authItem.serialNumber,
        transferCodePreview: transferToken.last4,
      },
      ipAddress: '127.0.0.1',
      userAgent: 'prisma/seed.ts',
    },
  })

  console.log('Seed complete', {
    shop: shop.shopifyShopDomain,
    product: product.title,
    customer: customer.email,
    authId: authItem.authId,
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
