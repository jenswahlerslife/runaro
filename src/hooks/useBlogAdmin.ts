import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface BlogAdminState {
  loading: boolean;
  isAdmin: boolean;
  profileId: string | null;
  error: string | null;
}

export function useBlogAdmin(): BlogAdminState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<BlogAdminState>({
    loading: true,
    isAdmin: false,
    profileId: null,
    error: null,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({
        loading: false,
        isAdmin: false,
        profileId: null,
        error: "Ingen bruger er logget ind.",
      });
      return;
    }

    let isMounted = true;
    setState((prev) => ({ ...prev, loading: true }));

    supabase
      .from("profiles")
      .select("id, is_blog_admin")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error("Failed to fetch blog admin profile", error);
          setState({
            loading: false,
            isAdmin: false,
            profileId: null,
            error: error.message ?? "Kunne ikke hente profiloplysninger.",
          });
          return;
        }

        setState({
          loading: false,
          isAdmin: Boolean(data?.is_blog_admin),
          profileId: data?.id ?? null,
          error: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, user]);

  return state;
}
