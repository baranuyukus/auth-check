import type { Prisma } from "@prisma/client";

export function asJson(
  value: Record<string, unknown> | Array<unknown>,
): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
