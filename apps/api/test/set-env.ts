process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://roamly:roamly@localhost:5432/roamly?schema=public';
process.env.API_PORT = process.env.API_PORT ?? '3001';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
