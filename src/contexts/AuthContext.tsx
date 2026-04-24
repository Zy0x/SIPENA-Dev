import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabaseExternal as supabase } from "@/lib/supabase-external";

// Session expires after 12 hours (client-side enforcement)
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const SESSION_TIMESTAMP_KEY = "sipena_session_start";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if session has exceeded max age
  const isSessionExpired = useCallback(() => {
    const startTime = localStorage.getItem(SESSION_TIMESTAMP_KEY);
    if (!startTime) return false;
    return Date.now() - parseInt(startTime, 10) > SESSION_MAX_AGE_MS;
  }, []);

  // Force logout on session expiry
  const handleSessionExpiry = useCallback(async () => {
    console.log("[Auth] Session expired after 12 hours, signing out...");
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/auth");
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Track session start time
        if (event === "SIGNED_IN" && session) {
          if (!localStorage.getItem(SESSION_TIMESTAMP_KEY)) {
            localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
          }
        }
        if (event === "SIGNED_OUT") {
          localStorage.removeItem(SESSION_TIMESTAMP_KEY);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check expiry before restoring session
      if (session && isSessionExpired()) {
        handleSessionExpiry();
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Periodic session expiry check (every 5 minutes)
    sessionCheckRef.current = setInterval(() => {
      if (isSessionExpired()) {
        handleSessionExpiry();
      }
    }, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
    };
  }, [isSessionExpired, handleSessionExpiry]);

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: name },
      },
    });
    
    if (!error && data?.user) {
      try {
        await supabase.from("notifications").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          type: "new_user_registration",
          title: "Pengguna Baru Terdaftar",
          message: `${name} (${email}) baru saja mendaftar di SIPENA`,
          data: {
            new_user_id: data.user.id,
            new_user_email: email,
            new_user_name: name,
            registered_at: new Date().toISOString(),
          },
        });
      } catch (notifError) {
        console.error("Failed to create admin notification:", notifError);
      }
    }
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  /**
   * Sign in dengan Google OAuth
   * Mendukung baik Lovable domain maupun custom domain
   */
  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    try {
      const redirectTo = `${window.location.origin}/`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut({ scope: "global" });
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
