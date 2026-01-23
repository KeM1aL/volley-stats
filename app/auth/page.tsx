"use client"

import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function AuthPage() {
  const { user } = useAuth();
  
  if (user) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirectTo");

    useEffect(() => {
      router.replace(redirectTo || "/");
    }, [router, redirectTo]);
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
