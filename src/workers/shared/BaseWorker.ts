import {
  WorkerEnv,
  SECURITY_HEADERS,
  CronTriggerPayload
} from './types';
import {
  validateEnv,
  createErrorResponse,
  createSuccessResponse,
  validateAuth
} from './utils';

export abstract class BaseWorker {
  protected abstract readonly requiredEnvVars: (keyof WorkerEnv)[];

  /**
   * Handle scheduled (cron) events
   */
  protected abstract handleScheduled(
    event: ScheduledEvent,
    env: WorkerEnv
  ): Promise<any>;

  /**
   * Handle manual trigger via HTTP POST
   */
  protected abstract handleManualTrigger(
    request: Request,
    env: WorkerEnv
  ): Promise<any>;

  /**
   * Main scheduled event handler
   */
  async scheduled(event: ScheduledEvent, env: WorkerEnv): Promise<Response> {
    try {
      validateEnv(env, this.requiredEnvVars);
      const result = await this.handleScheduled(event, env);
      return createSuccessResponse(result);
    } catch (error) {
      console.error('Scheduled event failed:', error);
      return createErrorResponse(error as Error);
    }
  }

  /**
   * Main fetch event handler
   */
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
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
      return createErrorResponse(error as Error);
    }
  }
}