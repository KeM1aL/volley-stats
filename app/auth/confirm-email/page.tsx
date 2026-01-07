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

export default function ConfirmEmailPage() {
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
        title: "Confirmation email sent",
        description: "Check your inbox for the verification link.",
      });

      // Start 30-second cooldown
      setCanResend(false);
      setCountdown(30);
    } catch (error) {
      console.error("Failed to resend confirmation:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to resend confirmation email",
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
            <CardTitle>Invalid Request</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              No email address provided.
            </p>
            <Button onClick={() => router.push("/auth")} className="w-full">
              Go to Login
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
          <CardTitle>Check Your Email</CardTitle>
          <CardDescription>
            We've sent a confirmation link to:
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
              <strong>Next steps:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Open the email from VolleyStats</li>
              <li>Click the confirmation link</li>
              <li>You'll be redirected to sign in</li>
            </ol>
          </div>

          <div className="pt-4 space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Didn't receive the email?
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
                  Sending...
                </>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                "Resend Confirmation Email"
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
              Back to Sign In
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            <p>Wrong email address?</p>
            <button
              onClick={() => router.push("/auth")}
              className="text-primary hover:underline"
            >
              Sign up with a different email
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
