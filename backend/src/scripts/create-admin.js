require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcryptjs");

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log('Cara pakai: node src/scripts/create-admin.js admin password123');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  await prisma.admin.upsert({
    where: { username },
    update: { password: hash },
    create: { username, password: hash },
  });

  console.log("Admin dibuat/diupdate:", username);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());