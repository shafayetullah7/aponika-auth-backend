import { closeSeedDb } from './db';
import { seedOAuthClients } from './oauth-clients.seed';

async function main() {
  console.log('🚀 Starting database seeding...');

  try {
    await seedOAuthClients();
    console.log('✨ Database seeding completed successfully!');
    await closeSeedDb();
    process.exit(0);
  } catch (error) {
    console.error('💥 Database seeding failed:', error);
    await closeSeedDb();
    process.exit(1);
  }
}

void main();
