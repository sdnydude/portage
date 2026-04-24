import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx apps/api/src/scripts/promote-admin.ts <email>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL || 'postgresql://portage:portage@10.0.0.251:5436/portage';
const client = postgres(databaseUrl);
const db = drizzle(client);

const [user] = await db.select({ id: users.id, email: users.email, role: users.role })
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (!user) {
  console.error(`No user found with email: ${email}`);
  await client.end();
  process.exit(1);
}

if (user.role === 'admin') {
  console.log(`${email} is already an admin.`);
  await client.end();
  process.exit(0);
}

await db.update(users)
  .set({ role: 'admin' })
  .where(eq(users.id, user.id));

console.log(`Promoted ${email} to admin.`);
await client.end();
