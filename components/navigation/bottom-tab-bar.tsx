"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useKeyboard } from "@/contexts/keyboard-context";
import { GuardedLink } from "@/components/guarded-link";
import { activeSection, showTabBar } from "@/lib/native/tab-bar";
import { navItems } from "./nav-items";
import { useNativeApp } from "./use-native-app";
import { useTextEntryKeyboard } from "./use-text-entry-keyboard";

/** Body class while the bar shows: `--tab-bar-offset` (globals.css) lifts other fixed bottom elements (the update banner) above it. */
const VISIBLE_CLASS = "tab-bar-visible";

const TabBarVisibleContext = createContext(false);

/** Decides once whether the bottom tab bar shows (installed app, signed in, not on the live match or sign-in pages, keyboard closed), for the bar and the content spacer. */
export function TabBarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { visible: keyboardOpen } = useKeyboard();
  const nativeApp = useNativeApp();
  const textEntryKeyboard = useTextEntryKeyboard(nativeApp);
  const visible = !!user && showTabBar({ nativeApp, pathname: pathname ?? "/", keyboardOpen: keyboardOpen || textEntryKeyboard });

  useEffect(() => {
    if (!visible) return;
    document.body.classList.add(VISIBLE_CLASS);
    return () => document.body.classList.remove(VISIBLE_CLASS);
  }, [visible]);

  return <TabBarVisibleContext.Provider value={visible}>{children}</TabBarVisibleContext.Provider>;
}

/** Whether the bottom tab bar shows. Needs `TabBarProvider`. */
export function useTabBarVisible(): boolean {
  return useContext(TabBarVisibleContext);
}

/** Installed app only: the four main sections as a bar above the home indicator / gesture bar. */
export function BottomTabBar() {
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const visible = useTabBarVisible();

  if (!visible) return null;
  const current = activeSection(pathname ?? "/");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-(--safe-area-inset-bottom) pl-(--safe-area-inset-left) pr-(--safe-area-inset-right)"
      data-testid="bottom-tab-bar"
    >
      <ul className="flex h-(--tab-bar-height)">
        {navItems(t).map(({ href, label, icon: Icon }) => {
          const active = current === href;
          return (
            <li key={href} className="flex-1">
              <GuardedLink
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
              </GuardedLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Empty space at the end of the page content equal to the bar, only while the bar shows (the safe-area inset is already padded by the layout). */
export function TabBarSpacer() {
  if (!useTabBarVisible()) return null;
  return <div className="h-(--tab-bar-height)" aria-hidden="true" />;
}
