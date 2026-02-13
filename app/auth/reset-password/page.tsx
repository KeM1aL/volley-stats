"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  PasswordStrengthIndicator,
  calculatePasswordStrength,
} from "@/components/auth/password-strength-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const formSchema = z
    .object({
      password: z.string().min(6, t('validation.passwordMinLength')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordsMustMatch'),
      path: ["confirmPassword"],
    })
    .refine(
      (data) => {
        const { strength } = calculatePasswordStrength(data.password);
        return strength !== "weak";
      },
      {
        message: t('resetPassword.passwordWeak'),
        path: ["password"],
      }
    );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");

  useEffect(() => {
    // Check if user has a valid session (from reset link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      if (!session) {
        toast({
          variant: "destructive",
          title: t('resetPassword.invalidOrExpiredLink'),
          description: t('resetPassword.requestNewResetLink'),
        });
      }
    });
  }, [toast, t]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: t('resetPassword.passwordUpdated'),
        description: t('resetPassword.passwordUpdatedDesc'),
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/auth");
      }, 2000);
    } catch (error) {
      console.error("Failed to reset password:", error);
      toast({
        variant: "destructive",
        title: t('toast.error'),
        description:
          error instanceof Error ? error.message : t('resetPassword.failedReset'),
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (hasSession === null) {
    return (
      <div className="container max-w-md mx-auto mt-20">
        <Card>
          <CardContent className="p-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="container max-w-md mx-auto mt-20">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>{t('resetPassword.linkExpired')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {t('resetPassword.linkExpiredDesc')}
            </p>
            <Button onClick={() => router.push("/auth")} className="w-full">
              {t('resetPassword.requestNewLink')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="container max-w-md mx-auto mt-20">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>{t('resetPassword.success')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t('resetPassword.successDesc')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-md mx-auto mt-20">
      <Card>
        <CardHeader>
          <CardTitle>{t('resetPassword.title')}</CardTitle>
          <CardDescription>
            {t('resetPassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('resetPassword.newPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <PasswordStrengthIndicator password={password} />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('resetPassword.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('resetPassword.resetPassword')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
