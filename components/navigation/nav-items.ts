import { Volleyball, Users, Settings, Trophy, type LucideIcon } from "lucide-react";
import type { NavSection } from "@/lib/native/tab-bar";

export interface NavItem {
  href: NavSection;
  label: string;
  icon: LucideIcon;
}

/** The main navigation entries, shared by the header (web) and the bottom tab bar (installed app). `t` is the `navigation` translator. */
export function navItems(t: (key: string) => string): NavItem[] {
  return [
    { href: "/championships", label: t("menu.championships"), icon: Trophy },
    { href: "/matches", label: t("menu.matches"), icon: Volleyball },
    { href: "/teams", label: t("menu.teams"), icon: Users },
    { href: "/settings", label: t("menu.settings"), icon: Settings },
  ];
}
