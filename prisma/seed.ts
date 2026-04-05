// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Usuarios base
  const pass = await bcrypt.hash('Secret123!', 10);

  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { email: 'alice@example.com', password: pass, nombre: 'Alice' },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { email: 'bob@example.com', password: pass, nombre: 'Bob' },
  });

  // Categorías base por módulo (opcional)
  await prisma.categoria.upsert({
    where: { id: 'seed-gastos' },
    update: {},
    create: { id: 'seed-gastos', nombre: 'General', modulo: 'GASTOS' },
  });
  await prisma.categoria.upsert({
    where: { id: 'seed-ingresos' },
    update: {},
    create: { id: 'seed-ingresos', nombre: 'Salario', modulo: 'INGRESOS' },
  });

  console.log({ user1, user2 });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
