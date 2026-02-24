"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Volleyball,
  BarChart3,
  Users,
  Settings,
  Menu,
  LogOut,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ThemeToggle } from "./theme-toggle";
import { FullScreenToggle } from "./fullscreen-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { useLandscape } from "@/hooks/use-landscape";

export function Navigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLandscape = useLandscape();
  const t = useTranslations('navigation');

  const routes = [
    {
      href: "/championships",
      label: t('menu.championships'),
      icon: Trophy,
    },
    {
      href: "/matches",
      label: t('menu.matches'),
      icon: Volleyball,
    },
    {
      href: "/teams",
      label: t('menu.teams'),
      icon: Users,
    },
    {
      href: "/settings",
      label: t('menu.settings'),
      icon: Settings,
    },
  ];

  // Compact navigation in landscape mode on live match pages
  const isLivePage = pathname?.includes('/live');
  if (isLandscape && isLivePage) {
    return (
      <header className="h-10 top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                        <Link
                          key={route.href}
                          href={route.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground",
                            pathname === route.href
                              ? "bg-accent text-accent-foreground"
                              : "transparent"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          {route.label}
                        </Link>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            )}
            <Link href="/" className="flex items-center pl-1">
              <Image
                src='/logo.png'
                alt={t('common.app.shortTitle')}
                width='24'
                height='24'
                className="rounded object-cover"
              />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <FullScreenToggle />
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex mx-auto h-14 items-center justify-between">
        <div className="flex items-center">
          {user && (
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
                        <Link
                          key={route.href}
                          href={route.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground",
                            pathname === route.href
                              ? "bg-accent text-accent-foreground"
                              : "transparent"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          {route.label}
                        </Link>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          )}
          <Link href="/" className="flex items-center gap-2 font-semibold pl-2">
            <Image
                  src='/logo.png'
                          alt={t('common.app.title')}
                          width='50'
                          height='50'
                          className="rounded-lg object-cover w-10 h-10 md:w-12 md:h-12"
                        />
          </Link>
          {user && (
            <nav className="hidden md:flex items-center gap-6 mx-6">
              {routes.map((route) => {
                const Icon = route.icon;
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                      pathname === route.href
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {route.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        <div className="flex items-center">
          <FullScreenToggle />
          <LanguageSwitcher />
          <ThemeToggle />
          {user && (
            <Button variant="ghost" size="sm" onClick={signOut} className="px-2 md:px-3 text-xs md:text-sm">
              <LogOut className="h-4 w-4 mr-1 md:mr-2" />
              <span>{t('actions.signOut')}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
