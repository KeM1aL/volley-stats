"use client";

import { useEffect, useState } from "react";
import { resizedByKeyboard, takesTextInput } from "@/lib/native/tab-bar";

function focusedFieldTakesText(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && takesTextInput({ tagName: el.tagName, type: (el as HTMLInputElement).type, isContentEditable: el.isContentEditable });
}

/**
 * True while a text field has focus and the keyboard has shrunk the viewport. The installed app's WebView resizes the page for
 * the keyboard and does not report it through `useKeyboard()`, so the tab bar watches for this itself. Registers nothing when disabled.
 */
export function useTextEntryKeyboard(enabled: boolean): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // The keyboard-free viewport height for the current width; null after a rotation with the keyboard open, until one is seen.
    let baseline: { width: number; height: number | null } = { width: window.innerWidth, height: window.innerHeight };
    let editing = focusedFieldTakesText();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const evaluate = () => {
      const keyboard = editing && resizedByKeyboard(baseline.height, window.innerHeight, window.screen.height);
      // Editing but not shrunk (keyboard closed, field still focused): this is the keyboard-free height.
      if (editing && !keyboard) baseline.height = Math.max(baseline.height ?? 0, window.innerHeight);
      setOpen(keyboard);
    };
    const onResize = () => {
      if (window.innerWidth !== baseline.width) {
        // Rotated: the old height means nothing. While editing, the keyboard may be shrinking the new one, so wait for a reliable height.
        baseline = { width: window.innerWidth, height: editing ? null : window.innerHeight };
      } else if (!editing) {
        baseline.height = window.innerHeight;
      }
      evaluate();
    };
    const onFocusIn = () => {
      clearTimeout(timer);
      editing = focusedFieldTakesText();
      evaluate();
    };
    const onFocusOut = () => {
      // Moving between two fields fires focusout then focusin: settle first so the bar does not flicker back.
      clearTimeout(timer);
      timer = setTimeout(() => {
        editing = focusedFieldTakesText();
        evaluate();
      }, 50);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled]);

  return enabled && open;
}
