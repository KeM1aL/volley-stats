import { normalizePath } from "@/lib/routes";

/** The sections of the installed app's bottom tab bar, in display order. */
export const NAV_SECTIONS = ["/championships", "/matches", "/teams", "/settings"] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

/** The section a page belongs to (`/teams/view` → `/teams`), or null outside the four sections. */
export function activeSection(pathname: string): NavSection | null {
  const path = normalizePath(pathname);
  return NAV_SECTIONS.find((section) => path === section || path.startsWith(`${section}/`)) ?? null;
}

/**
 * Whether the bottom tab bar shows. Only in the installed app; not over the live match (the court needs the space),
 * not on the sign-in pages, and not while the on-screen keyboard is open.
 */
export function showTabBar({ nativeApp, pathname, keyboardOpen }: { nativeApp: boolean; pathname: string; keyboardOpen: boolean }): boolean {
  if (!nativeApp || keyboardOpen) return false;
  const path = normalizePath(pathname);
  return path !== "/matches/live" && path !== "/auth" && !path.startsWith("/auth/");
}

const NO_KEYBOARD_INPUT_TYPES = new Set(["checkbox", "radio", "button", "submit", "reset", "image", "file", "range", "color"]);

/** Whether focusing this element opens the on-screen keyboard (text fields, text areas, editable content). */
export function takesTextInput({ tagName, type, isContentEditable }: { tagName: string; type?: string; isContentEditable?: boolean }): boolean {
  const tag = tagName.toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") return !NO_KEYBOARD_INPUT_TYPES.has((type ?? "text").toLowerCase());
  return !!isContentEditable;
}

/**
 * The Android WebView resizes the page for the keyboard instead of reporting it: a viewport that lost this much is the keyboard.
 * `baselineHeight` is the full-height viewport seen before; null after a rotation with the keyboard open (no keyboard-free height
 * known yet), when the screen height stands in for it.
 */
export function resizedByKeyboard(baselineHeight: number | null, height: number, screenHeight: number): boolean {
  return (baselineHeight ?? screenHeight) - height >= 100;
}
