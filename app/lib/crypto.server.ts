import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashOpaqueValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildOpaqueToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function buildNumericCode(length = 8) {
  const digits = randomBytes(length)
    .toString("hex")
    .replace(/\D/g, "");

  return digits.slice(0, length).padEnd(length, "7");
}

export function safeLast4(value: string) {
  return value.slice(-4);
}

export function verifyOpaqueValue(input: string, expectedHash: string) {
  const hashedInput = Buffer.from(hashOpaqueValue(input), "utf8");
  const hashedExpected = Buffer.from(expectedHash, "utf8");

  if (hashedInput.length !== hashedExpected.length) {
    return false;
  }

  return timingSafeEqual(hashedInput, hashedExpected);
}
