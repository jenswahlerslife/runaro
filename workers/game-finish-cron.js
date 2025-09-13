// Cloudflare Worker for automatic game finishing cron job

export default {
  async scheduled(event, env, ctx) {
    // Call the Supabase edge function to finish due games
    const response = await fetch('https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/finish-due-games', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer game-finish-cron-secret-2025',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trigger: 'cron',
        timestamp: new Date().toISOString()
      })
    });

    console.log(`Game finish cron executed at ${new Date().toISOString()}`);
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error finishing games: ${errorText}`);
      throw new Error(`Game finish cron failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('Game finish result:', result);
    
    return new Response('Game finish cron completed successfully', { status: 200 });
  },

  async fetch(request) {
    // Handle direct HTTP requests to the worker (for testing)
    if (request.method === 'GET') {
      return new Response('Game finish cron worker is active. Use POST to trigger manually.', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    if (request.method === 'POST') {
      // Allow manual triggering for testing
      try {
        const response = await fetch('https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/finish-due-games', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer game-finish-cron-secret-2025',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trigger: 'manual',
            timestamp: new Date().toISOString()
          })
        });

        const result = await response.json();
        
        return new Response(JSON.stringify({
          success: response.ok,
          status: response.status,
          result: result
        }), {
          status: response.ok ? 200 : 500,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Method not allowed', { status: 405 });
  }
};