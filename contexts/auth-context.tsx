"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { User } from "@/lib/types";
import { getUser } from "@/lib/api/users";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

type LoadingStage = "authenticating" | "profile" | "memberships" | "complete";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  loadingStage: LoadingStage | null;
  error: Error | null;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  reloadUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<LoadingStage | null>(
    "authenticating"
  );
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const sessionRef = useRef<Session | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(async () => {
        console.debug("onAuthStateChange event:", event, "session:", session);

        // Handle specific auth events
        switch (event) {
          case "SIGNED_IN":
            console.debug("User signed in", [
              userRef.current,
              sessionRef.current,
              session,
            ]);
            break;

          case "SIGNED_OUT":
            console.log("User signed out");
            toast({
              title: "Signed out",
              description: "You have been successfully signed out.",
            });
            setUser(null);
            setSession(null);
            setError(null);
            setLoadingStage(null);
            setIsLoading(false);
            return; // Early return, no need to load user

          case "TOKEN_REFRESHED":
            console.log("Auth token refreshed successfully");
            break;

          case "USER_UPDATED":
            console.log("User data updated");
            break;

          default:
            console.debug("Auth event:", event);
        }
        if (session && session?.access_token === sessionRef.current?.access_token) {
          // Avoid refresh on tab refocus
          return;
        }
        sessionRef.current = session;
        setSession(session);
        setError(null);

        if (session) {
          if(session.user?.id === userRef.current?.id) {
            // Avoid refresh if new access token for same user
            return;
          }
          try {
            setLoadingStage("profile");
            const user = await getUser(session, (stage) => {
              setLoadingStage(stage);
            });
            userRef.current = user;
            setUser(user);
            setError(null);
            setLoadingStage("complete");
          } catch (error) {
            console.error("Failed to load user profile:", error);
            setUser(null);
            setError(
              error instanceof Error
                ? error
                : new Error("Failed to load profile")
            );
            setLoadingStage(null);
          } finally {
          }
        } else {
          setUser(null);
          setError(null);
          setLoadingStage(null);
          setIsLoading(false);
        }

        setIsLoading(false);
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Session health monitoring - check for expiry and warn user
  useEffect(() => {
    if (!session) return;

    const checkSessionExpiry = () => {
      if (!session?.expires_at) return;

      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

      // Warn user 5 minutes before expiry
      if (timeUntilExpiry > 0 && timeUntilExpiry <= fiveMinutes) {
        const minutesLeft = Math.ceil(timeUntilExpiry / 60000);
        console.warn(`Session expires in ${minutesLeft} minute(s)`);

        const handleExtendSession = async () => {
          try {
            const { error } = await supabase.auth.refreshSession();
            if (error) throw error;
            toast({
              title: "Session Extended",
              description: "Your session has been successfully refreshed.",
            });
          } catch (error) {
            console.error("Failed to refresh session:", error);
            toast({
              variant: "destructive",
              title: "Refresh Failed",
              description:
                "Could not extend your session. Please sign in again.",
            });
          }
        };

        toast({
          title: "Session Expiring Soon",
          description: `Your session will expire in ${minutesLeft} minute(s). Click "Extend Session" to stay logged in.`,
          action: (
            <ToastAction altText="Extend Session" onClick={handleExtendSession}>
              Extend Session
            </ToastAction>
          ),
        });
      }

      // Log session already expired
      if (timeUntilExpiry <= 0) {
        console.warn("Session has expired");
      }
    };

    // Check immediately
    checkSessionExpiry();

    // Check every 5 minutes
    const intervalId = setInterval(checkSessionExpiry, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [session, toast]);

  const signOut = async () => {
    await supabase.auth.signOut();

    window.location.href = "/";
  };

  const reloadUser = async () => {
    if (session) {
      setError(null);
      setLoadingStage("profile");
      try {
        const user = await getUser(session, (stage) => {
          setLoadingStage(stage);
        });
        setUser(user);
        setLoadingStage("complete");
      } catch (error) {
        console.error("Failed to reload user:", error);
        setError(
          error instanceof Error ? error : new Error("Failed to reload profile")
        );
        setLoadingStage(null);
      }
    }
  };

  // Only show loading screen when we have a session and are loading user data
  if (isLoading && (loadingStage !== "authenticating" || session)) {
    const loadingMessages: Record<LoadingStage, string> = {
      authenticating: "Authenticating...",
      profile: "Loading your profile...",
      memberships: "Loading team memberships...",
      complete: "Almost ready...",
    };

    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {loadingStage ? loadingMessages[loadingStage] : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (error && session && !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center max-w-md p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Failed to Load Profile
          </h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => reloadUser()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        loadingStage,
        error,
        signOut,
        setSession,
        reloadUser,
        setUser,
      }}
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
