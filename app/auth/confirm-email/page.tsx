"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

export default function ConfirmEmailPage() {
  const t = useTranslations('auth');
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const email = searchParams.get("email");

  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (!email || !canResend) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) throw error;

      toast({
        title: t('confirmEmail.confirmationSent'),
        description: t('confirmEmail.confirmationSentDesc'),
      });

      // Start 30-second cooldown
      setCanResend(false);
      setCountdown(30);
    } catch (error) {
      console.error("Failed to resend confirmation:", error);
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description:
          error instanceof Error
            ? error.message
            : t('confirmEmail.failedResend'),
      });
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return (
      <div className="container max-w-md mx-auto mt-20">
        <Card>
          <CardHeader>
            <CardTitle>{t('confirmEmail.invalidRequest')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {t('confirmEmail.noEmailProvided')}
            </p>
            <Button onClick={() => router.push("/auth")} className="w-full">
              {t('confirmEmail.goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-md mx-auto mt-20">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>{t('confirmEmail.checkYourEmail')}</CardTitle>
          <CardDescription>
            {t('confirmEmail.sentTo')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-center font-medium">
              {email}
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>{t('confirmEmail.nextSteps')}</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>{t('confirmEmail.step1')}</li>
              <li>{t('confirmEmail.step2')}</li>
              <li>{t('confirmEmail.step3')}</li>
            </ol>
          </div>

          <div className="pt-4 space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              {t('confirmEmail.didntReceive')}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={!canResend || isResending}
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('confirmEmail.resending')}
                </>
              ) : countdown > 0 ? (
                t('confirmEmail.resendIn', { seconds: countdown })
              ) : (
                t('confirmEmail.resendConfirmation')
              )}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/auth")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('confirmEmail.backToSignIn')}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            <p>{t('confirmEmail.wrongEmail')}</p>
            <button
              onClick={() => router.push("/auth")}
              className="text-primary hover:underline"
            >
              {t('confirmEmail.signupDifferent')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
