"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
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

const routes = [
  {
    href: "/championships",
    label: "Championships",
    icon: Trophy,
  },
  {
    href: "/matches",
    label: "Matches",
    icon: Volleyball,
  },
  {
    href: "/teams",
    label: "Teams",
    icon: Users,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex mx-auto h-14 items-center justify-between">
        <div className="flex items-center">
          {user && (
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                  <nav className="flex flex-col gap-4 mt-4">
                    {routes.map((route) => {
                      const Icon = route.icon;
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
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
                          alt="VolleyStats for Dummies"
                          width='50'
                          height='50'
                          className="rounded-lg object-cover"
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
          <ThemeToggle />
          {user && (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
