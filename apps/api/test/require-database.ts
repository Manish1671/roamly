import { PrismaClient } from '@prisma/client';

export async function requirePostgres(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (cause) {
    throw new Error(
      'PostgreSQL is required for API integration tests. Ensure DATABASE_URL points at a running database with migrations applied.',
      { cause },
    );
  }
}
