import { normalizePath } from "@/lib/routes";

export type BackAction = "close-dialog" | "confirm-leave" | "back" | "home" | "exit";

export interface BackState {
  /** The "Update required" page is up: it covers the app, so back must not move the page underneath it. */
  blocked?: boolean;
  dialogOpen: boolean;
  guardActive: boolean;
  canGoBack: boolean;
  pathname: string;
}

/** Attribute of the "Update required" page, so the back button can tell it is up. */
export const UPDATE_BLOCK_ATTRIBUTE = "data-update-block";

/** What Android's back button does. Subscribing replaces the system behaviour, so every case is decided here. */
export function backAction({ blocked = false, dialogOpen, guardActive, canGoBack, pathname }: BackState): BackAction {
  if (blocked) return "exit";
  if (dialogOpen) return "close-dialog";
  if (guardActive) return "confirm-leave";
  // The home page closes the app, whatever the history holds.
  if (normalizePath(pathname) === "/") return "exit";
  return canGoBack ? "back" : "home";
}
