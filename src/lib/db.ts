import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url) {
    throw new Error('DATABASE_URL não configurada. Defina a conexão no ambiente.')
  }

  if (url.startsWith('libsql://') || url.startsWith('libsql:')) {
    if (!authToken) {
      throw new Error('TURSO_AUTH_TOKEN não configurado para a conexão libSQL.')
    }
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter })
  }

  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
