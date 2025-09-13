// Deno edge function: afslut alle aktive spil hvor end_date er passeret
import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: games, error } = await supabase
    .from("games")
    .select("id")
    .eq("status", "active")
    .lt("end_date", new Date().toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let finishedCount = 0;
  if (games) {
    for (const g of games) {
      try {
        await supabase.rpc("finish_game", { p_game_id: g.id });
        finishedCount++;
      } catch (e) {
        console.error(`Failed to finish game ${g.id}:`, e);
      }
    }
  }

  return new Response(JSON.stringify({ 
    finished: finishedCount,
    total_found: games?.length ?? 0,
    timestamp: new Date().toISOString()
  }), { 
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});