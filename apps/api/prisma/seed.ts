import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.LUMI_ADMIN_USERNAME ?? 'admin';
  const password = process.env.LUMI_ADMIN_PASSWORD;
  if (!password || password.length < 12 || password.length > 256) {
    throw new Error('LUMI_ADMIN_PASSWORD must be provided and contain at least 12 characters');
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { wxOpenId: `admin:${username}` },
      create: { wxOpenId: `admin:${username}`, role: UserRole.ADMIN },
      update: { role: UserRole.ADMIN, status: 'ACTIVE' },
    });

    await tx.adminCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, username, passwordHash },
      update: { username, passwordHash, disabledAt: null },
    });
    await tx.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  });
  console.log(`Admin credential provisioned for ${username}; previous sessions revoked`);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
