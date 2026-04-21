import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
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

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) {
        console.error("Failed to fetch profile:", error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
    setProfileLoaded(true);
  };

  useEffect(() => {
    // getSession() is the primary mechanism for restoring a persisted session.
    // It runs outside the auth lock so fetchProfile won't deadlock here.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfileLoaded(true);
      }
      setLoading(false);
    }).catch((err) => {
      console.error("getSession error:", err);
      setProfileLoaded(true);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          setProfileLoaded(false);
          setLoading(false);
        } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          setSession(session);
          setUser(session?.user ?? null);
          // Defer fetchProfile outside the auth lock to avoid deadlock
          if (session?.user) {
            const userId = session.user.id;
            setProfileLoaded(false);
            setTimeout(() => { fetchProfile(userId); }, 0);
          }
        } else if (event === "TOKEN_REFRESHED") {
          setSession(session);
          setUser(session?.user ?? null);
          // Re-fetch profile in case the initial fetch failed due to an expired token
          if (session?.user) {
            const userId = session.user.id;
            setTimeout(() => { fetchProfile(userId); }, 0);
          }
        }
        // INITIAL_SESSION is handled by getSession() above — ignore it here
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
