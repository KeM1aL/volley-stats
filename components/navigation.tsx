"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ThemeToggle } from "./theme-toggle";
import { FullScreenToggle } from "./fullscreen-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { useLandscape } from "@/hooks/use-landscape";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GuardedLink } from "@/components/guarded-link";
import { useConfirmLeave } from "@/components/providers/leave-guard-provider";
import { SyncBadge } from "@/components/sync/sync-badge";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { allowNextUnload } from "@/hooks/use-unsent-guard";
import { normalizePath } from "@/lib/routes";
import { navItems } from "@/components/navigation/nav-items";
import { useNativeApp } from "@/components/navigation/use-native-app";

export function Navigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const tSync = useTranslations("sync");
  const syncStatus = useSyncStatus();
  const unsentCount = (syncStatus?.pendingCount ?? 0) + (syncStatus?.rejectedCount ?? 0);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const { confirmLeave } = useConfirmLeave();
  const handleSignOut = async () => {
    // Unsent changes: the sign-out warning says where they go (they upload at the next sign-in), and it
    // stands for leaving a live match too, so it is the only dialog. Otherwise ask before leaving a live match.
    if (unsentCount > 0) {
      setConfirmSignOut(true);
      return;
    }
    const decision = await confirmLeave();
    if (decision === "stay") return;
    if (decision === "leave") allowNextUnload();
    void signOut();
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLandscape = useLandscape();
  const t = useTranslations('navigation');

  const routes = navItems(t);
  // The installed app navigates with the bottom tab bar: no hamburger and no header links (the compact live-page header keeps its menu).
  const nativeApp = useNativeApp();

  // Compact navigation in landscape mode on live match pages
  const isLivePage = normalizePath(pathname ?? "") === "/matches/live";
  if (isLandscape && isLivePage) {
    return (
      <header className="h-10 top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
        <div className="flex h-8 items-center justify-between px-2">
          <div className="flex items-center">
            {user && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('actions.openMenu')}>
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] sm:w-[300px]" title={t('actions.openMenu')}>
                  <nav className="flex flex-col gap-4 mt-4">
                    {routes.map((route) => {
                      const Icon = route.icon;
                      return (
                        <GuardedLink
                          key={route.href}
                          href={route.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground",
                            normalizePath(pathname ?? "") === route.href
                              ? "bg-accent text-accent-foreground"
                              : "transparent"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          {route.label}
                        </GuardedLink>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            )}
            <GuardedLink href="/" className="flex items-center pl-1">
              <Image
                src='/logo.png'
                alt={t('common.app.shortTitle')}
                width='24'
                height='24'
                className="rounded object-cover"
              />
            </GuardedLink>
          </div>
          <div className="flex items-center gap-1">
            {user && <SyncBadge compact />}
            <FullScreenToggle />
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="container flex mx-auto h-14 items-center justify-between">
        <div className="flex items-center">
          {user && !nativeApp && (
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t('actions.openMenu')}>
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] sm:w-[300px]" title={t('actions.openMenu')}>
                  <nav className="flex flex-col gap-4 mt-4">
                    {routes.map((route) => {
                      const Icon = route.icon;
                      return (
                        <GuardedLink
                          key={route.href}
                          href={route.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground",
                            normalizePath(pathname ?? "") === route.href
                              ? "bg-accent text-accent-foreground"
                              : "transparent"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          {route.label}
                        </GuardedLink>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          )}
          <GuardedLink href="/" className="flex items-center gap-2 font-semibold pl-2">
            <Image
                  src='/logo.png'
                          alt={t('common.app.title')}
                          width='50'
                          height='50'
                          className="rounded-lg object-cover w-10 h-10 md:w-12 md:h-12"
                        />
          </GuardedLink>
          {user && !nativeApp && (
            <nav className="hidden md:flex items-center gap-6 mx-6">
              {routes.map((route) => {
                const Icon = route.icon;
                return (
                  <GuardedLink
                    key={route.href}
                    href={route.href}
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                      normalizePath(pathname ?? "") === route.href
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {route.label}
                  </GuardedLink>
                );
              })}
            </nav>
          )}
        </div>
        <div className="flex items-center">
          {user && <SyncBadge />}
          <FullScreenToggle />
          <LanguageSwitcher />
          <ThemeToggle />
          {user && (
            <Button variant="ghost" size="sm" onClick={() => void handleSignOut()} className="px-2 md:px-3 text-xs md:text-sm">
              <LogOut className="h-4 w-4 mr-1 md:mr-2" />
              <span>{t('actions.signOut')}</span>
            </Button>
          )}
        </div>
      </div>
      <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <AlertDialogContent data-testid="sign-out-warning">
          <AlertDialogHeader>
            <AlertDialogTitle>{tSync("guards.signOutTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{tSync("guards.signOutBody", { count: unsentCount })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tSync("claim.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSignOut(false);
                allowNextUnload();
                void signOut();
              }}
            >
              {tSync("guards.signOutConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
