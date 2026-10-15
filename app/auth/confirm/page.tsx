"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/lib/supabase/client";
import { isSafeRedirectTarget, routes } from "@/lib/routes";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function ConfirmLink() {
  const t = useTranslations("auth.confirmLink");
  const params = useSearchParams();
  const router = useRouter();
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const invalidLink = !tokenHash || !type || !OTP_TYPES.includes(type);
  const [rejected, setRejected] = useState(false);
  const failed = invalidLink || rejected;
  const started = useRef(false);

  useEffect(() => {
    if (invalidLink || started.current || !tokenHash || !type) return; // verifyOtp consumes the token: run once
    started.current = true;
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) return setRejected(true);
      const next = params.get("next");
      router.replace(type === "recovery" ? "/auth/reset-password" : isSafeRedirectTarget(next) ? next : "/");
    });
  }, [invalidLink, tokenHash, type, params, router]);

  if (!failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-16" data-testid="confirm-verifying">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-muted-foreground">{t("verifying")}</p>
      </div>
    );
  }
  return (
    <Card className="max-w-md mx-auto mt-12" data-testid="confirm-invalid">
      <CardHeader>
        <CardTitle>{t("invalidTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("invalidBody")}</p>
        <Link className="underline" href={routes.signIn()}>{t("backToSignIn")}</Link>
      </CardContent>
    </Card>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmLink />
    </Suspense>
  );
}
