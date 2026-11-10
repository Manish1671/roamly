import type { EnvConfig } from './env.schema';

export default (): EnvConfig => ({
  NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) ?? 'development',
  API_HOST: process.env.API_HOST ?? '0.0.0.0',
  API_PORT: Number(process.env.API_PORT ?? 3001),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost:3000',
});
