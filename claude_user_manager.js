
// Claude's Comprehensive Supabase User Manager
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export class SupabaseUserManager {
  // Get all users with detailed info
  async getAllUsers() {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    
    return users.users.map(user => ({
      id: user.id,
      email: user.email,
      confirmed: !!user.email_confirmed_at,
      created: user.created_at,
      lastSignIn: user.last_sign_in_at,
      metadata: user.user_metadata
    }));
  }
  
  // Delete user completely (auth + all related data)
  async deleteUserCompletely(email) {
    try {
      const users = await this.getAllUsers();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      
      // Delete related data
      await supabase.from('profiles').delete().eq('user_id', user.id);
      await supabase.from('activities').delete().eq('user_id', user.id);
      await supabase.from('league_memberships').delete().eq('user_id', user.id);
      
      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      
      if (error) throw error;
      
      return { 
        success: true, 
        message: `User ${email} deleted completely`,
        deletedUserId: user.id 
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  
  // Create test user for configuration testing
  async createTestUser(email = null) {
    const testEmail = email || `claude-test-${Date.now()}@example.com`;
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'TestPassword123!',
        options: {
          data: {
            username: 'claudetest',
            display_name: 'Claude Test User',
            age: 25
          },
          emailRedirectTo: 'https://runaro.dk/auth'
        }
      });
      
      if (error) throw error;
      
      return {
        success: true,
        email: testEmail,
        userId: data.user?.id,
        needsConfirmation: !data.session && !!data.user,
        message: 'Test user created successfully'
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  
  // Get system status overview
  async getSystemStatus() {
    try {
      const users = await this.getAllUsers();
      const confirmedUsers = users.filter(u => u.confirmed).length;
      const unconfirmedUsers = users.filter(u => !u.confirmed).length;
      
      return {
        totalUsers: users.length,
        confirmedUsers,
        unconfirmedUsers,
        users: users,
        authConfigWorking: unconfirmedUsers > 0, // If we have unconfirmed users, email confirmation works
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { error: error.message };
    }
  }
  
  // Clean up all test users
  async cleanupTestUsers() {
    try {
      const users = await this.getAllUsers();
      const testUsers = users.filter(u => 
        u.email.includes('test') || 
        u.email.includes('claude') ||
        u.email.includes('config') ||
        u.email.includes('example.com')
      );
      
      const results = [];
      for (const user of testUsers) {
        const result = await this.deleteUserCompletely(user.email);
        results.push({ email: user.email, ...result });
      }
      
      return {
        success: true,
        deletedCount: results.filter(r => r.success).length,
        results
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Quick access functions
const userManager = new SupabaseUserManager();

export const getAllUsers = () => userManager.getAllUsers();
export const deleteUser = (email) => userManager.deleteUserCompletely(email);
export const createTestUser = (email) => userManager.createTestUser(email);
export const getSystemStatus = () => userManager.getSystemStatus();
export const cleanupTestUsers = () => userManager.cleanupTestUsers();

console.log('🎯 Claude Supabase User Manager loaded!');
console.log('Available functions: getAllUsers, deleteUser, createTestUser, getSystemStatus, cleanupTestUsers');
  