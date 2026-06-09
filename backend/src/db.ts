import { PrismaClient } from '@prisma/client';

// Single Prisma client for the whole process.
export const prisma = new PrismaClient();
