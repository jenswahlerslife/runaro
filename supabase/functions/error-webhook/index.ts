import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (req.method === 'POST') {
      const { record } = await req.json()
      
      // This is called by the database trigger when a new error is inserted
      if (record && record.severity === 'error') {
        console.log('🚨 New error detected:', {
          id: record.id,
          type: record.error_type,
          message: record.error_message,
          url: record.url,
          timestamp: record.timestamp,
          severity: record.severity,
          user_id: record.user_id
        })

        // Here you could add external webhook notifications
        // For example, send to Discord, Slack, email, etc.
        
        // Example Discord webhook (uncomment and add your webhook URL):
        /*
        const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')
        if (discordWebhookUrl) {
          const discordPayload = {
            content: `🚨 **New Error on Runaro**\n\n**Type:** ${record.error_type}\n**Message:** ${record.error_message}\n**URL:** ${record.url}\n**Time:** ${new Date(record.timestamp).toLocaleString('da-DK')}\n**Severity:** ${record.severity}`
          }
          
          await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload)
          })
        }
        */

        return new Response(
          JSON.stringify({ success: true, message: 'Error notification sent' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // GET request to list recent errors (for debugging)
    if (req.method === 'GET') {
      const { data: errors, error } = await supabaseClient
        .from('error_reports')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20)

      if (error) throw error

      return new Response(
        JSON.stringify({ errors }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in webhook function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})