import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

function createPrismaClient() {
  const hyperdriveConnectionString = process.env.HYPERDRIVE_CONNECTION_STRING;

  if (hyperdriveConnectionString) {
    const adapter = new PrismaPg({
      connectionString: hyperdriveConnectionString,
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
