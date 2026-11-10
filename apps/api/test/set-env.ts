process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://roamly:roamly@localhost:5434/roamly?schema=public';
process.env.API_PORT = process.env.API_PORT ?? '3001';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ??
  '0123456789012345678901234567890123456789012345678901234567890';
process.env.SESSION_TTL_HOURS = process.env.SESSION_TTL_HOURS ?? '168';
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE ?? 'false';
