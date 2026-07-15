import "dotenv/config";

const DEFAULT_PORT = 3000;

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  databaseUrl: process.env.DATABASE_URL,
};

export function requireDatabaseUrl(): string {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set your PostgreSQL connection string.");
  }

  return env.databaseUrl;
}
