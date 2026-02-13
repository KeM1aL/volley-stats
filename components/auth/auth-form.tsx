"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setSession } = useAuth();
  const t = useTranslations('auth');

  const formSchema = z.object({
    email: z.string().email(t('validation.invalidEmail')),
    password: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Form submitted", { isForgotPassword, values });
    setIsLoading(true);
    try {
      // Handle forgot password
      if (isForgotPassword) {
        console.log("Processing forgot password for:", values.email);
        const { error } = await supabase.auth.resetPasswordForEmail(
          values.email,
          {
            redirectTo: `${window.location.origin}/auth/callback?type=recovery&next=/auth/reset-password`,
          }
        );

        if (error) {
          console.error("Reset password error:", error);
          throw error;
        }

        console.log("Reset email sent successfully");
        toast({
          title: t('toast.resetEmailSent'),
          description: t('toast.checkEmailForReset'),
        });
        setIsForgotPassword(false);
        form.reset();
        return;
      }

      // Validate password for login/signup
      if (!values.password || values.password.length < 6) {
        toast({
          variant: "destructive",
          title: t('toast.error'),
          description: t('validation.passwordMinLength'),
        });
        setIsLoading(false);
        return;
      }

      // TypeScript now knows password exists and is valid
      const credentials = {
        email: values.email,
        password: values.password as string,
      };

      const authResponse = isSignUp
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

      if (authResponse.error) throw authResponse.error;

      if (isSignUp) {
        // Redirect to confirmation page with email
        router.push(`/auth/confirm-email?email=${encodeURIComponent(values.email)}`);
      } else {
        // Update session in context
        setSession(authResponse.data.session);
        const redirectTo = searchParams.get("redirectTo");
        router.replace(redirectTo || "/");
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to sign in:", error);
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description: error instanceof Error ? error.message : t('toast.genericError'),
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input placeholder={t('emailPlaceholder')} autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isForgotPassword && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('password')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete={isSignUp ? "new-password" : "current-password"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {!isSignUp && !isForgotPassword && (
          <div className="text-right">
            <Button
              type="button"
              variant="link"
              className="px-0 h-auto font-normal text-sm"
              onClick={() => setIsForgotPassword(true)}
              disabled={isLoading}
            >
              {t('forgotPassword')}
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isForgotPassword ? t('sendResetLink') : isSignUp ? t('signUp') : t('signIn')}
          </Button>
          {isForgotPassword ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsForgotPassword(false)}
              disabled={isLoading}
            >
              {t('backToSignIn')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={isLoading}
            >
              {isSignUp ? t('alreadyHaveAccount') : t('needAccount')}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
