// Shared types for Cloudflare Workers

export interface WorkerEnv {
  SUPABASE_URL: string;
  CRON_SECRET: string;
  // Add other environment variables as needed
}

export interface CronTriggerPayload {
  trigger: 'cron' | 'manual';
  timestamp: string;
}

export interface WorkerResponse<T = any> {
  ok: boolean;
  status?: number;
  body?: T;
  error?: string;
}

export interface SupabaseResponse<T = any> {
  status: number;
  body: T;
}

// Common headers used across workers
export const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
} as const;

export const SECURITY_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': "geolocation=(), microphone=(), camera=(), payment=()",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;