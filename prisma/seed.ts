import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash("Test123!", 12)

  const admin = await db.user.upsert({
    where: { email: "admin@admin.dev" },
    update: {},
    create: {
      firstName: "admin",
      lastName: "admin",
      email: "admin@admin.dev",
      passwordHash,
      verified: true,
      emailVerified: new Date(),
    },
  })

  console.log(`✅ Seeded admin user: ${admin.email} (id: ${admin.id})`)
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
