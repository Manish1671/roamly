export * from './auth';

export const ROAMLY_APP_NAME = 'Roamly' as const;

export const API_PREFIX = '/api/v1' as const;

export type ServiceHealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthCheckResult {
  status: ServiceHealthStatus;
  timestamp: string;
}
