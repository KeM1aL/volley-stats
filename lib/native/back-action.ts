import { normalizePath } from "@/lib/routes";

export type BackAction = "close-dialog" | "confirm-leave" | "back" | "home" | "exit";

export interface BackState {
  dialogOpen: boolean;
  guardActive: boolean;
  canGoBack: boolean;
  pathname: string;
}

/** What Android's back button does. Subscribing replaces the system behaviour, so every case is decided here. */
export function backAction({ dialogOpen, guardActive, canGoBack, pathname }: BackState): BackAction {
  if (dialogOpen) return "close-dialog";
  if (guardActive) return "confirm-leave";
  if (canGoBack) return "back";
  return normalizePath(pathname) === "/" ? "exit" : "home";
}
