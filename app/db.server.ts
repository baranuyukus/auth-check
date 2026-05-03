import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

function createPrismaClient() {
  const connectionString =
    process.env.HYPERDRIVE_CONNECTION_STRING ?? process.env.DATABASE_URL;

  if (connectionString) {
    const adapter = new PrismaPg({
      connectionString,
    });

    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
}

const prisma = global.prismaGlobal ?? createPrismaClient();

export default prisma;
