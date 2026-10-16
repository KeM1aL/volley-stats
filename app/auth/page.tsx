"use client";

import { AuthForm } from "@/components/auth/auth-form";
import { LoadingPage } from "@/components/loading-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { isSafeRedirectTarget, routes } from "@/lib/routes";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";

function AuthPage() {
  const { user } = useAuth();
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  useEffect(() => {
    if (user) router.replace(isSafeRedirectTarget(redirectTo) ? redirectTo : routes.home());
  }, [user, router, redirectTo]);

  return (
    <div className="container max-w-md mx-auto mt-8 sm:mt-12 md:mt-20 px-4">
      {searchParams.get("account-deleted") === "1" && (
        <Alert className="mb-4" data-testid="account-deleted">
          <AlertDescription>{t("accountDeleted")}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl text-center">
            {t('welcome')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <AuthForm />
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <AuthPage />
    </Suspense>
  );
}
