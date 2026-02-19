import { createContext, useContext, useEffect, useState, useRef, useMemo, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  trial_ends_at: string | null;
  subscription_status: string;
  subscription_tier: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  profileLoaded: boolean;
  isAdmin: boolean;
  hasAccess: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const initialLoadDone = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      const result = await Promise.race([
        supabase
          .from("user_profiles")
          .select("*")
          .eq("id", userId)
          .single(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Profile fetch timed out")), 5000)
        ),
      ]);
      if (result.error) {
        console.error("Failed to fetch profile:", result.error);
        // Only clear profile if we don't already have one (initial load).
        // On re-fetches (tab focus, token refresh), keep the existing profile.
        setProfile((prev) => prev ?? null);
      } else {
        setProfile(result.data);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
      setProfile((prev) => prev ?? null);
    }
    setProfileLoaded(true);
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      initialLoadDone.current = true;
      setLoading(false);
    }).catch((err) => {
      console.error("getSession error:", err);
      initialLoadDone.current = true;
      setLoading(false);
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    // After initial load, update state silently without flashing loading
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (event === "SIGNED_OUT") {
            setSession(null);
            setUser(null);
            setProfile(null);
            setProfileLoaded(false);
          } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
              await fetchProfile(session.user.id);
            }
          }
          // TOKEN_REFRESHED and other events: no state updates needed.
          // Supabase client internally updates its token; we don't need to
          // re-render the app for token refreshes.
        } catch (err) {
          console.error("Auth state change error:", err);
        }
        // Only set loading=false if this is the first auth event (before getSession resolves)
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = profile?.is_admin ?? false;

  const hasAccess = (() => {
    if (!profile) return false;
    if (profile.is_admin) return true;
    if (profile.subscription_status === "active") return true;
    if (
      profile.subscription_status === "trial" &&
      profile.trial_ends_at &&
      new Date(profile.trial_ends_at) > new Date()
    ) {
      return true;
    }
    return false;
  })();

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName ?? "" } },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileLoaded(false);
  };

  const value = useMemo(
    () => ({ user, session, profile, profileLoaded, isAdmin, hasAccess, loading, signIn, signUp, signOut }),
    [user, session, profile, profileLoaded, isAdmin, hasAccess, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
