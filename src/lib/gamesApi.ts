import { supabase } from "@/integrations/supabase/client";

export async function rpcStartGame(gameId: string, durationDays?: number) {
  const { data, error } = await supabase.rpc("start_game", {
    p_game_id: gameId,
    p_duration_days: durationDays,
  });
  if (error) throw error;
  return data;
}

export async function rpcGetGameOverview(gameId: string) {
  const { data, error } = await supabase.rpc("get_game_overview", { p_game_id: gameId });
  if (error) throw error;
  return data as {
    meta: {
      id: string;
      status: "setup" | "active" | "finished" | "cancelled";
      duration_days: number | null;
      start_date: string | null;
      end_date: string | null;
      activated_at: string | null;
      winner_user_id: string | null;
    };
    counts: { member_count: number; base_count: number };
    leaderboard: { user_id: string; area_km2: number }[];
  };
}

export async function rpcGetGameInfo(gameId: string) {
  const { data, error } = await supabase.rpc("get_game_info", { p_game_id: gameId });
  if (error) throw error;
  // Check for function-level error in response
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as {
    id: string;
    name: string;
    status: string;
    created_at: string;
    start_date: string | null;
    league_id: string;
  };
}

export async function rpcGetPlayerStats(gameId: string, userId: string) {
  const { data, error } = await supabase.rpc("get_player_game_stats", {
    p_game_id: gameId,
    p_user_id: userId,
  });
  if (error) throw error;
  // data: { total_distance_km: number, total_moving_time_s: number }[]
  return (data && data[0]) || { total_distance_km: 0, total_moving_time_s: 0 };
}

export async function rpcFinishGame(gameId: string) {
  const { data, error } = await supabase.rpc("finish_game", {
    p_game_id: gameId,
  });
  if (error) throw error;
  return data;
}

export async function rpcMaybeActivateGame(gameId: string) {
  const { data, error } = await supabase.rpc("maybe_activate_game", {
    p_game_id: gameId,
  });
  if (error) throw error;
  return data;
}

export async function setPlayerBase(gameId: string, activityId: string) {
  // Bruger eksisterende RPC set_player_base(game_id, activity_id)
  const { data, error } = await supabase.rpc("set_player_base", {
    p_game_id: gameId,
    p_activity_id: activityId,
  });
  if (error) throw error;
  return data;
}

export async function createGame(leagueId: string, name: string, durationDays?: number) {
  const { data, error } = await supabase.rpc("create_game", {
    p_league_id: leagueId,
    p_name: name,
    p_duration_days: durationDays,
  });
  if (error) throw error;

  // Check for function-level error in response
  if ((data as any)?.success === false) {
    throw new Error((data as any)?.error || "Failed to create game");
  }

  // ✅ Ensure RPC returns at least { game_id: uuid, ... }
  const gameId = (data as any)?.game_id;
  if (!gameId) throw new Error("create_game returned no game_id");

  return {
    id: gameId,
    name: (data as any)?.game_name,
    duration_days: (data as any)?.duration_days,
    status: (data as any)?.status,
    user_plan: (data as any)?.user_plan,
    ...data
  };
}

export async function rpcGetActiveGameForLeague(leagueId: string) {
  const { data, error } = await supabase.rpc("get_active_game_for_league", { p_league_id: leagueId });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as {
    id: string | null;
    name: string | null;
    status: "setup" | "active" | null;
    start_date: string | null;
    duration_days: number | null;
    end_at: string | null;
    time_left_seconds: number | null;
  } | { game: null };
}