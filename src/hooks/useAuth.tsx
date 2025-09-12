import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string, displayName: string, age: number) => Promise<{ error: any }>;
  signInWithMagicLink: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Simplified helper function to ensure user has a profile
const ensureProfileExists = async (user: User) => {
  try {
    const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user';
    const displayName = user.user_metadata?.display_name || username;
    const age = user.user_metadata?.age ? Number(user.user_metadata.age) : 25;

    // First check if profile exists to avoid unnecessary upserts
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existingProfile) {
      console.log('Profile already exists for user:', user.id);
      return;
    }

    // Create profile with proper structure
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,       // Primary key
        user_id: user.id,  // Foreign key to auth.users
        username,
        display_name: displayName,
        age: age,
      });

    if (error) {
      // If it's a duplicate key error, that's fine - profile already exists
      if (error.code === '23505') {
        console.log('Profile already exists (caught duplicate):', user.id);
        return;
      }
      throw error;
    }

    console.log('Profile ensured for user:', user.id);
  } catch (error) {
    // Don't block authentication flow if profile creation fails
    console.warn('Profile creation warning (non-blocking):', error);
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Short timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth loading timeout, setting loading to false');
        setLoading(false);
      }
    }, 3000); // Reduced to 3 seconds

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        clearTimeout(loadingTimeout);
        console.log('Auth state change:', event, session?.user?.id || 'no user');
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Run profile creation in background (non-blocking)
        if (session?.user) {
          ensureProfileExists(session.user).catch(err => 
            console.warn('Background profile creation failed:', err)
          );
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;
        
        clearTimeout(loadingTimeout);
        
        if (error) {
          console.error('Auth session error:', error);
        }
        
        console.log('Initial session check:', session?.user?.id || 'no user');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Run profile creation in background (non-blocking)
        if (session?.user) {
          ensureProfileExists(session.user).catch(err => 
            console.warn('Background profile creation failed:', err)
          );
        }
      })
      .catch((error) => {
        if (!mounted) return;
        clearTimeout(loadingTimeout);
        console.error('Auth session error:', error);
        setLoading(false);
      });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, username: string, displayName: string, age: number) => {
    try {
      console.log('Attempting signup for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName,
            name: displayName, // Also store as 'name' for compatibility
            age: age,
          },
          emailRedirectTo: 'https://runaro.dk/auth'
        }
      });

      console.log('Signup response:', { data, error });

      // Handle specific errors first
      if (error) {
        console.error('Signup error:', error);
        
        if (error.message?.includes('User already registered')) {
          return { 
            error: { 
              message: 'Email-adressen er allerede registreret. Prøv at logge ind i stedet.' 
            } 
          };
        }
        
        return { error };
      }

      // If signup successful but user needs email confirmation
      if (data?.user && !data.session) {
        console.log('User created but needs email confirmation');
        return { 
          error: null,
          needsConfirmation: true
        };
      }

      // If signup successful with session (auto-confirmed)
      if (data?.session) {
        console.log('User created and auto-confirmed');
        return { error: null };
      }

      return { error: null };
      
    } catch (e) {
      console.error('Unexpected signup error:', e);
      return { 
        error: { 
          message: 'Uventet fejl ved tilmelding. Prøv igen eller kontakt support.' 
        } 
      };
    }
  };

  const signInWithMagicLink = async (email: string) => {
    const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${SITE_URL}/auth/callback`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithMagicLink,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};