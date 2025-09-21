import { WorkerEnv, WorkerResponse, JSON_HEADERS, SECURITY_HEADERS } from './types';

/**
 * Validates required environment variables
 */
export function validateEnv(env: WorkerEnv, required: (keyof WorkerEnv)[]): void {
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing ${key} environment variable`);
    }
  }
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string | Error,
  status: number = 500
): Response {
  const message = error instanceof Error ? error.message : error;
  const body: WorkerResponse = { ok: false, error: message };

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS },
  });
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): Response {
  const body: WorkerResponse<T> = { ok: true, body: data };

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS },
  });
}

/**
 * Validates authorization header against a secret
 */
export function validateAuth(request: Request, secret: string): boolean {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const xSecret = request.headers.get('x-cron-secret') || request.headers.get('X-CRON-SECRET');
  const provided = (auth && auth.startsWith('Bearer ') ? auth.slice(7) : auth) || xSecret || '';

  return secret && provided === secret;
}

/**
 * Safely parses JSON response text
 */
export async function parseResponseSafely(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Makes a request to a Supabase Edge Function
 */
export async function callSupabaseFunction(
  env: WorkerEnv,
  functionName: string,
  payload: any,
  authToken?: string
): Promise<{ status: number; body: any }> {
  const url = `${env.SUPABASE_URL}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken || env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await parseResponseSafely(response);

  if (!response.ok) {
    throw new Error(`${functionName} failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return { status: response.status, body };
}