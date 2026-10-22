"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/contexts/auth-context";
import { isPublicPath, isSafeRedirectTarget, routes } from "@/lib/routes";

/** Pages other than the public ones need a signed-in user; others go to sign-in and come back. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, session, isLoading } = useAuth();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const isPublic = isPublicPath(pathname);
  const signedOut = !isLoading && !user && !session;

  useEffect(() => {
    if (isPublic || !signedOut) return;
    // window.location, not useSearchParams: no Suspense boundary needed around the whole app.
    const target = pathname + window.location.search;
    router.replace(routes.signIn(isSafeRedirectTarget(target) ? target : null));
  }, [isPublic, signedOut, pathname, router]);

  if (isPublic) return <>{children}</>;
  if (isLoading || signedOut) return <LoadingPage />;
  return <>{children}</>;
}
