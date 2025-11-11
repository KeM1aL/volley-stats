"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { User } from "@/lib/types";
import { getUser } from "@/lib/api/users";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

type LoadingStage = 'authenticating' | 'profile' | 'memberships' | 'complete';

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
  const [loadingStage, setLoadingStage] = useState<LoadingStage | null>('authenticating');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let getUserTimeoutId: NodeJS.Timeout | null = null;

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.debug("onAuthStateChange", _event, session);
      setSession(session);
      setError(null);

      if (session) {
        // Safety timeout: force loading to stop after 100 seconds (when getUser actually starts)
        // This is longer than getUser's internal 30s timeout + 2 retries = ~90s total
        getUserTimeoutId = setTimeout(() => {
          if (isLoading) {
            console.error('Auth loading timeout - forcing completion after 100 seconds');
            setError(new Error('Loading timed out. Please refresh the page.'));
            setIsLoading(false);
            setLoadingStage(null);
          }
        }, 100000); // 100 seconds (accounts for 30s timeout x 3 attempts)

        try {
          setLoadingStage('profile');
          const user = await getUser(session, (stage) => {
            setLoadingStage(stage);
          });
          setUser(user);
          setError(null);
          setLoadingStage('complete');
        } catch (error) {
          console.error('Failed to load user profile:', error);
          setUser(null);
          setError(error instanceof Error ? error : new Error('Failed to load profile'));
          setLoadingStage(null);
        } finally {
          if (getUserTimeoutId) {
            clearTimeout(getUserTimeoutId);
          }
        }
      } else {
        setUser(null);
        setError(null);
        setLoadingStage(null);
      }

      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (getUserTimeoutId) {
        clearTimeout(getUserTimeoutId);
      }
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();

    window.location.href = "/";
  };

  const reloadUser = async () => {
    if (session) {
      setError(null);
      setLoadingStage('profile');
      try {
        const user = await getUser(session, (stage) => {
          setLoadingStage(stage);
        });
        setUser(user);
        setLoadingStage('complete');
      } catch (error) {
        console.error('Failed to reload user:', error);
        setError(error instanceof Error ? error : new Error('Failed to reload profile'));
        setLoadingStage(null);
      }
    }
  };

  // Only show loading screen when we have a session and are loading user data
  if (isLoading && (loadingStage !== 'authenticating' || session)) {
    const loadingMessages: Record<LoadingStage, string> = {
      authenticating: 'Authenticating...',
      profile: 'Loading your profile...',
      memberships: 'Loading team memberships...',
      complete: 'Almost ready...',
    };

    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {loadingStage ? loadingMessages[loadingStage] : 'Loading...'}
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
