import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection with retry logic and timeouts
const connectionOptions = {
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of clients in the pool
  connectionTimeoutMillis: 5000, // Connection timeout
  idle_timeout: 30, // How long a client is allowed to remain idle before being closed
  connect_timeout: 10, // Maximum time to wait for connection
};

export const pool = new Pool(connectionOptions);

// Add connection error handling
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  // Implement automatic reconnection
  setTimeout(() => {
    console.log('Attempting to reconnect to database...');
    pool.connect().catch(err => console.error('Reconnection failed:', err));
  }, 2000);
});

export const db = drizzle({ client: pool, schema });
