import { Volleyball, Users, Settings, Trophy, CircleUser, type LucideIcon } from "lucide-react";
import type { NavSection } from "@/lib/native/tab-bar";

export interface NavItem {
  href: NavSection;
  label: string;
  icon: LucideIcon;
}

/**
 * The main navigation entries, shared by the header (web) and the bottom tab bar (installed app). `t` is the `navigation` translator.
 * In the installed app the last entry is the Profile (person icon): the same `/settings` page, which also holds the account and sign-out.
 */
export function navItems(t: (key: string) => string, { nativeApp = false }: { nativeApp?: boolean } = {}): NavItem[] {
  return [
    { href: "/championships", label: t("menu.championships"), icon: Trophy },
    { href: "/matches", label: t("menu.matches"), icon: Volleyball },
    { href: "/teams", label: t("menu.teams"), icon: Users },
    nativeApp
      ? { href: "/settings", label: t("menu.profile"), icon: CircleUser }
      : { href: "/settings", label: t("menu.settings"), icon: Settings },
  ];
}
