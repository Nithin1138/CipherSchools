import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client instance.
 * Reused across the application to avoid connection pool exhaustion.
 */
const prisma = new PrismaClient();

export default prisma;
