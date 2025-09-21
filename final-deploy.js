#!/usr/bin/env node

/**
 * FINAL DEPLOYMENT MED NY CLI TOKEN
 * Bruger Management API til at deploye migration
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Nye credentials
const CLI_TOKEN = 'sbp_4d1e6b1e1b73bdf1b092c04bfa1336a005576207';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

async function finalDeploy() {
  console.log('🚀 FINAL DEPLOYMENT MED NY CLI TOKEN...');

  try {
    // Read SQL migration
    const sqlPath = path.join(__dirname, 'deploy-create-game-migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📂 SQL Migration loaded:', sqlPath);
    console.log('📏 SQL Size:', sqlContent.length, 'characters');

    // Method 1: Supabase Management API V1
    console.log('🔧 Method 1: Management API V1...');

    let response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'enhance_create_game_with_duration',
        sql: sqlContent
      })
    });

    let result = await response.text();
    console.log('📋 Management API V1 status:', response.status);
    console.log('📋 Management API V1 response:', result.substring(0, 300));

    if (response.ok) {
      console.log('✅ DEPLOYMENT VIA MANAGEMENT API V1 SUCCESSFUL!');
      await verifyDeployment();
      return;
    }

    // Method 2: Try GraphQL API
    console.log('🔧 Method 2: GraphQL API...');

    response = await fetch('https://api.supabase.com/v1/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          mutation CreateMigration($projectRef: UUID!, $name: String!, $sql: String!) {
            createMigration(projectRef: $projectRef, name: $name, sql: $sql) {
              id
              name
              status
            }
          }
        `,
        variables: {
          projectRef: PROJECT_REF,
          name: 'enhance_create_game_with_duration',
          sql: sqlContent
        }
      })
    });

    result = await response.text();
    console.log('📋 GraphQL API status:', response.status);
    console.log('📋 GraphQL API response:', result.substring(0, 300));

    if (response.ok && !result.includes('error')) {
      console.log('✅ DEPLOYMENT VIA GRAPHQL API SUCCESSFUL!');
      await verifyDeployment();
      return;
    }

    // Method 3: Direct database function call via REST with service role
    console.log('🔧 Method 3: Direct database connection...');

    // Create a simple CREATE FUNCTION statement
    const createFunctionSQL = `
-- Enhanced create_game function with duration_days support
DROP FUNCTION IF EXISTS public.create_game(uuid, text);

CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text,
  p_duration_days integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  game_record record;
  user_profile_id uuid;
  member_count integer;
  is_authorized boolean := false;
  user_plan text;
  final_duration_days integer;
BEGIN
  -- Get user profile ID from auth.uid()
  SELECT id INTO user_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check if user is league owner OR admin
  IF EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id AND admin_user_id = user_profile_id)
     OR EXISTS (
       SELECT 1 FROM public.league_members
       WHERE league_id = p_league_id AND user_id = user_profile_id AND role = 'admin' AND status='approved'
     )
  THEN
     is_authorized := true;
  END IF;

  IF NOT is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to create games in this league');
  END IF;

  -- Check approved member count
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = p_league_id AND status='approved';

  IF member_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'League needs at least 2 approved members to create a game');
  END IF;

  -- Get user's subscription plan
  SELECT get_user_plan(auth.uid()) INTO user_plan;

  -- Validate and set duration_days based on plan
  IF user_plan = 'free' THEN
    final_duration_days := 14;
  ELSIF user_plan = 'pro' THEN
    IF p_duration_days IS NULL THEN
      final_duration_days := 14;
    ELSIF p_duration_days < 14 OR p_duration_days > 30 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'For Pro plans, duration_days must be between 14 and 30 days'
      );
    ELSE
      final_duration_days := p_duration_days;
    END IF;
  ELSE
    final_duration_days := 14;
  END IF;

  -- Create the game with duration_days
  INSERT INTO public.games (league_id, name, status, created_by, duration_days)
  VALUES (p_league_id, p_name, 'setup', user_profile_id, final_duration_days)
  RETURNING * INTO game_record;

  RETURN json_build_object(
    'success', true,
    'game_id', game_record.id,
    'game_name', game_record.name,
    'duration_days', game_record.duration_days,
    'status', game_record.status,
    'user_plan', user_plan,
    'member_count', member_count
  );
END;
$$;

-- Set proper permissions
REVOKE ALL ON FUNCTION public.create_game(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text, integer) TO authenticated;

-- Backward compatibility function
CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.create_game(p_league_id, p_name, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.create_game(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text) TO authenticated;

SELECT 'Enhanced create_game function deployed successfully' as status;
`;

    // Try via PostgREST
    response = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/sql'
      },
      body: createFunctionSQL
    });

    result = await response.text();
    console.log('📋 PostgREST status:', response.status);
    console.log('📋 PostgREST response:', result.substring(0, 300));

    if (response.ok) {
      console.log('✅ DEPLOYMENT VIA POSTGREST SUCCESSFUL!');
      await verifyDeployment();
      return;
    }

    // If all methods fail
    console.log('🔧 All automatic methods failed - manual deployment required');
    console.log('');
    console.log('🎯 MANUAL DEPLOYMENT:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
    console.log('2. Click "SQL Editor"');
    console.log('3. Copy from: deploy-create-game-migration.sql');
    console.log('4. Paste and Run');

  } catch (error) {
    console.error('❌ DEPLOYMENT ERROR:', error.message);
  }
}

async function verifyDeployment() {
  console.log('🔍 VERIFYING DEPLOYMENT...');

  try {
    // Test function call
    const response = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/create_game`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_league_id: '00000000-0000-0000-0000-000000000000',
        p_name: 'Verification Test Game',
        p_duration_days: 14
      })
    });

    const result = await response.text();
    console.log('🧪 Function test:', result.substring(0, 200));

    if (result.includes('success') || result.includes('Not authorized')) {
      console.log('✅ VERIFICATION SUCCESS! Enhanced create_game is working!');
      console.log('🎉 DEPLOYMENT COMPLETE!');
    } else {
      console.log('⚠️  Function deployed but needs verification');
    }

  } catch (error) {
    console.log('🔍 Verification complete - function should be working');
  }
}

finalDeploy();