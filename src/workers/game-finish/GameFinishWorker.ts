// @ts-nocheck
import { BaseWorker } from '../shared/BaseWorker';
import { WorkerEnv, CronTriggerPayload } from '../shared/types';
import { callSupabaseFunction } from '../shared/utils';

export class GameFinishWorker extends BaseWorker {
  protected readonly requiredEnvVars: (keyof WorkerEnv)[] = [
    'SUPABASE_URL',
    'CRON_SECRET'
  ];

  protected async handleScheduled(
    event: ScheduledEvent,
    env: WorkerEnv
  ): Promise<any> {
    return this.triggerFinishGames(env, 'cron');
  }

  protected async handleManualTrigger(
    request: Request,
    env: WorkerEnv
  ): Promise<any> {
    return this.triggerFinishGames(env, 'manual');
  }

  private async triggerFinishGames(
    env: WorkerEnv,
    trigger: 'cron' | 'manual'
  ): Promise<any> {
    const payload: CronTriggerPayload = {
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
  scheduled: (event: ScheduledEvent, env: WorkerEnv) =>
    worker.scheduled(event, env),
  fetch: (request: Request, env: WorkerEnv) =>
    worker.fetch(request, env),
};