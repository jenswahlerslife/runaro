-- Set up cron job to finish due games every 30 minutes

-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the finish-due-games function to run every 30 minutes
-- This will call our edge function which finishes all games past their end_date
-- Note: We use a placeholder token here - the actual CRON_SECRET should be set via environment variables
SELECT cron.schedule(
    'finish-due-games-job',
    '*/30 * * * *', -- every 30 minutes
    $$
    SELECT net.http_post(
        url := 'https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/finish-due-games',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer cron-token-placeholder'
        ),
        body := '{}'
    )::text;
    $$
);

-- Verify the cron job was created (commented out to avoid schema issues)
-- You can verify the cron job manually by running:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'finish-due-games-job';

SELECT 'Cron job for finishing games set up successfully!' as status;