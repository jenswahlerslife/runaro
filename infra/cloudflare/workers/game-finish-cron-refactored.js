// Cloudflare Worker for automatic game finishing cron job
// Refactored to use isolated worker architecture
// This file is generated from src/workers/game-finish/GameFinishWorker.ts

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

const SECURITY_HEADERS = {
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': "geolocation=(), microphone=(), camera=(), payment=()",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// Utility functions
function validateEnv(env, required) {
  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing ${key} environment variable`);
    }
  }
}

function createErrorResponse(error, status = 500) {
  const message = error instanceof Error ? error.message : error;
  const body = { ok: false, error: message };

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS },
  });
}

function createSuccessResponse(data, status = 200) {
  const body = { ok: true, body: data };

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...SECURITY_HEADERS },
  });
}

function validateAuth(request, secret) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const xSecret = request.headers.get('x-cron-secret') || request.headers.get('X-CRON-SECRET');
  const provided = (auth && auth.startsWith('Bearer ') ? auth.slice(7) : auth) || xSecret || '';

  return secret && provided === secret;
}

async function parseResponseSafely(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function callSupabaseFunction(env, functionName, payload, authToken) {
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

// Game Finish Worker Implementation
class GameFinishWorker {
  constructor() {
    this.requiredEnvVars = ['SUPABASE_URL', 'CRON_SECRET'];
  }

  async scheduled(event, env) {
    try {
      validateEnv(env, this.requiredEnvVars);
      const result = await this.handleScheduled(event, env);
      return createSuccessResponse(result);
    } catch (error) {
      console.error('Scheduled event failed:', error);
      return createErrorResponse(error);
    }
  }

  async fetch(request, env) {
    try {
      // Health check
      if (request.method === 'GET') {
        return new Response('OK', { status: 200, headers: SECURITY_HEADERS });
      }

      // Manual trigger
      if (request.method === 'POST') {
        validateEnv(env, this.requiredEnvVars);

        if (!validateAuth(request, env.CRON_SECRET)) {
          return createErrorResponse('Unauthorized', 401);
        }

        const result = await this.handleManualTrigger(request, env);
        return createSuccessResponse(result);
      }

      return new Response('Method not allowed', {
        status: 405,
        headers: SECURITY_HEADERS
      });
    } catch (error) {
      console.error('Fetch handler failed:', error);
      return createErrorResponse(error);
    }
  }

  async handleScheduled(event, env) {
    return this.triggerFinishGames(env, 'cron');
  }

  async handleManualTrigger(request, env) {
    return this.triggerFinishGames(env, 'manual');
  }

  async triggerFinishGames(env, trigger) {
    const payload = {
      trigger,
      timestamp: new Date().toISOString()
    };

    const result = await callSupabaseFunction(
      env,
      'finish-due-games',
      payload
    );

    return {
      status: result.status,
      body: result.body,
      trigger,
      timestamp: payload.timestamp
    };
  }
}

// Export worker instance
const worker = new GameFinishWorker();

export default {
  scheduled: (event, env) => worker.scheduled(event, env),
  fetch: (request, env) => worker.fetch(request, env),
};