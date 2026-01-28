"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { LoadingPage } from "@/components/loading-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function AuthPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (user) {
      const redirectTo = searchParams.get("redirectTo");
      router.replace(redirectTo || "/");
    }
  }, [user, router, searchParams]);

  if (user) {
    return <LoadingPage />;
  }

  return (
    <div className="container max-w-md mx-auto mt-8 sm:mt-12 md:mt-20 px-4">
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl text-center">
            Welcome to VolleyStats for Dummies
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <AuthForm />
        </CardContent>
      </Card>
    </div>
  );
}
