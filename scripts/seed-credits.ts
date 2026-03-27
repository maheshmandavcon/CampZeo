import { PrismaClient } from './lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding credit packages...');
  
  const packages = [
    {
      name: 'Starter SMS Pack',
      price: 500,
      credits: 1000,
      type: 'SMS',
      isActive: true,
    },
    {
      name: 'Pro SMS Pack',
      price: 1000,
      credits: 1500,
      type: 'SMS',
      isActive: true,
    },
  ];

  for (const pkg of packages) {
    await prisma.creditPackage.upsert({
      where: { id: packages.indexOf(pkg) + 1 },
      update: pkg,
      create: pkg,
    });
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
