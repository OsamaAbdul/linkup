import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles"> & { onboarding_completed?: boolean };

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  activeRole: string | null;
  setActiveRole: (role: string | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getToken: () => Promise<string | null>; // New helper for Edge Functions
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, profile: null, roles: [], activeRole: null, setActiveRole: () => { }, loading: true,
  signOut: async () => { }, refreshProfile: async () => { },
  getToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [activeRole, setActiveRoleState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveRole = (role: string | null) => {
    setActiveRoleState(role);
    if (role) localStorage.setItem("linkup_active_role", role);
  };

  const fetchLock = useRef<string | null>(null);

  // Helper to get a guaranteed fresh token for your create-order calls
  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const fetchProfileAndRoles = async (userId: string) => {
    if (fetchLock.current === userId) return;
    fetchLock.current = userId;

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Fetch timeout")), 5000)
      );

      const fetchPromise = Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      const [{ data: profileData, error: pError }, { data: rolesData, error: rError }] = result as any;

      if (!pError && profileData) setProfile(profileData as any);
      if (!rError && rolesData) {
        const fetchedRoles = rolesData.map((r: any) => r.role);
        setRoles(fetchedRoles);

        // Initialize active role
        const savedRole = localStorage.getItem("linkup_active_role");
        if (savedRole && fetchedRoles.includes(savedRole)) {
          setActiveRoleState(savedRole);
        } else if (fetchedRoles.length > 0) {
          // Priority: seller > first role
          const initialRole = fetchedRoles.includes("seller") ? "seller" : fetchedRoles[0];
          setActiveRoleState(initialRole);
        } else {
          setActiveRoleState("buyer");
        }
      }

    } catch (error) {
      console.error("Auth Data Fetch Error:", error);
    } finally {
      fetchLock.current = null;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfileAndRoles(user.id);
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchProfileAndRoles(initialSession.user.id);
        }
      } catch (err) {
        console.error("Auth Init Error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          if (['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
            // Non-blocking profile fetch
            setTimeout(() => fetchProfileAndRoles(currentSession.user.id), 0);
          }
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, roles, activeRole, setActiveRole, loading,
      signOut, refreshProfile, getToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}