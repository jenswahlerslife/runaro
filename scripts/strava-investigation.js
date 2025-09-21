#!/usr/bin/env node

/**
 * Strava Import Investigation
 * Analyze why users have 0 activities despite Strava connections
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class StravaInvestigator {
  constructor() {
    this.issues = [];
    this.recommendations = [];
  }

  async investigate() {
    console.log('🔍 STRAVA IMPORT INVESTIGATION');
    console.log('='.repeat(50));

    await this.analyzeStravaUsers();
    await this.checkActivitiesTable();
    await this.analyzeTokens();
    await this.checkImportFunctions();
    await this.testImportFlow();
    await this.generateReport();
  }

  async analyzeStravaUsers() {
    console.log('\n👥 ANALYZING STRAVA USERS...');

    try {
      const { data: stravaUsers, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, strava_access_token, strava_refresh_token, strava_expires_at, created_at')
        .not('strava_access_token', 'is', null);

      if (error) throw error;

      console.log(`   📊 Users with Strava tokens: ${stravaUsers?.length || 0}`);

      if (stravaUsers && stravaUsers.length > 0) {
        stravaUsers.forEach((user, i) => {
          console.log(`   ${i + 1}. User: ${user.username || user.display_name || 'Unknown'}`);
          console.log(`      - Token exists: ${!!user.strava_access_token}`);
          console.log(`      - Refresh token: ${!!user.strava_refresh_token}`);
          console.log(`      - Expires: ${user.strava_expires_at || 'Not set'}`);
          console.log(`      - Registered: ${user.created_at}`);

          // Check if token is expired
          if (user.strava_expires_at) {
            const expiresAt = new Date(user.strava_expires_at);
            const now = new Date();
            if (expiresAt < now) {
              this.issues.push(`User ${user.username}: Strava token expired on ${expiresAt.toISOString()}`);
            }
          } else {
            this.issues.push(`User ${user.username}: No expiration date set for Strava token`);
          }
        });
      } else {
        this.issues.push('No users have Strava tokens despite analysis showing 2 connections');
      }

    } catch (error) {
      this.issues.push(`Failed to analyze Strava users: ${error.message}`);
    }
  }

  async checkActivitiesTable() {
    console.log('\n📊 CHECKING ACTIVITIES TABLE...');

    try {
      // Check table structure
      const { data: sample, error: structureError } = await supabase
        .from('activities')
        .select('*')
        .limit(1);

      if (structureError) {
        this.issues.push(`Activities table access issue: ${structureError.message}`);
        return;
      }

      console.log('   ✅ Activities table is accessible');

      // Check for any activities
      const { count, error: countError } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.issues.push(`Cannot count activities: ${countError.message}`);
        return;
      }

      console.log(`   📊 Total activities: ${count || 0}`);

      if (count === 0) {
        this.issues.push('Zero activities in database despite Strava connections');

        // Check if there are any import attempts
        const { data: errorReports } = await supabase
          .from('error_reports')
          .select('*')
          .ilike('error_message', '%strava%')
          .limit(10);

        if (errorReports && errorReports.length > 0) {
          console.log(`   🚨 Found ${errorReports.length} Strava-related errors:`);
          errorReports.forEach(error => {
            console.log(`      - ${error.error_message}`);
          });
        } else {
          console.log('   📝 No Strava-related errors in error reports');
          this.issues.push('No error reports for Strava imports - may indicate import process never runs');
        }
      }

    } catch (error) {
      this.issues.push(`Activities table analysis failed: ${error.message}`);
    }
  }

  async analyzeTokens() {
    console.log('\n🔑 ANALYZING TOKEN VALIDITY...');

    try {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, strava_access_token, strava_refresh_token, strava_expires_at')
        .not('strava_access_token', 'is', null);

      if (users && users.length > 0) {
        for (const user of users) {
          if (user.strava_expires_at) {
            const expiresAt = new Date(user.strava_expires_at);
            const now = new Date();
            const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

            console.log(`   🔑 ${user.username}: Token expires in ${hoursUntilExpiry.toFixed(1)} hours`);

            if (hoursUntilExpiry < 0) {
              this.issues.push(`${user.username}: Token expired ${Math.abs(hoursUntilExpiry).toFixed(1)} hours ago`);
            } else if (hoursUntilExpiry < 24) {
              this.recommendations.push(`${user.username}: Token expires soon (${hoursUntilExpiry.toFixed(1)}h)`);
            }
          }

          if (!user.strava_refresh_token) {
            this.issues.push(`${user.username}: Missing refresh token - cannot auto-refresh`);
          }
        }
      }

    } catch (error) {
      this.issues.push(`Token analysis failed: ${error.message}`);
    }
  }

  async checkImportFunctions() {
    console.log('\n⚙️ CHECKING IMPORT FUNCTIONS...');

    const importFunctions = [
      'strava-activities',
      'strava-auth',
      'transfer-activity'
    ];

    // Check if Edge Functions exist by looking for references
    const { data: errorReports } = await supabase
      .from('error_reports')
      .select('error_message, error_type')
      .or(importFunctions.map(f => `error_message.ilike.%${f}%`).join(','))
      .limit(10);

    if (errorReports && errorReports.length > 0) {
      console.log(`   🚨 Found errors related to import functions:`);
      errorReports.forEach(error => {
        console.log(`      - ${error.error_type}: ${error.error_message}`);
      });
    } else {
      console.log('   📝 No errors found for import functions');
      this.issues.push('No import function errors - functions may not be running at all');
    }
  }

  async testImportFlow() {
    console.log('\n🧪 TESTING IMPORT FLOW...');

    // We can't actually call the Edge Functions from here, but we can check related data
    try {
      // Check if there are any webhook calls or function invocations
      const { data: recentErrors } = await supabase
        .from('error_reports')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentErrors && recentErrors.length > 0) {
        console.log(`   📊 Recent errors (last 7 days): ${recentErrors.length}`);

        const stravaErrors = recentErrors.filter(e =>
          e.error_message?.toLowerCase().includes('strava') ||
          e.error_type?.toLowerCase().includes('strava')
        );

        if (stravaErrors.length > 0) {
          console.log(`   🚨 Strava-related errors: ${stravaErrors.length}`);
          stravaErrors.slice(0, 3).forEach(error => {
            console.log(`      - ${error.error_type}: ${error.error_message.substring(0, 100)}...`);
          });
        } else {
          console.log('   📝 No recent Strava-related errors');
          this.issues.push('No recent Strava activity - import process may be inactive');
        }
      } else {
        console.log('   📝 No recent errors logged');
        this.recommendations.push('Consider adding more detailed logging to import process');
      }

    } catch (error) {
      this.issues.push(`Import flow test failed: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📋 STRAVA IMPORT INVESTIGATION REPORT');
    console.log('='.repeat(50));

    console.log('\n🚨 ISSUES IDENTIFIED:');
    if (this.issues.length === 0) {
      console.log('   ✅ No critical issues found');
    } else {
      this.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    console.log('\n💡 RECOMMENDATIONS:');
    if (this.recommendations.length === 0) {
      console.log('   📋 No specific recommendations');
    } else {
      this.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Check Strava OAuth callback URLs in production');
    console.log('2. Test Strava Edge Functions manually');
    console.log('3. Verify webhook endpoints are receiving data');
    console.log('4. Check if users are actually trying to import activities');
    console.log('5. Add more detailed logging to import process');

    console.log('\n📄 Investigation complete!');
  }
}

const investigator = new StravaInvestigator();
investigator.investigate().catch(console.error);