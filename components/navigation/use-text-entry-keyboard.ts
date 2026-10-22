"use client";

import { useEffect, useState } from "react";
import { resizedByKeyboard, takesTextInput } from "@/lib/native/tab-bar";

function focusedFieldTakesText(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && takesTextInput({ tagName: el.tagName, type: (el as HTMLInputElement).type, isContentEditable: el.isContentEditable });
}

/**
 * True while a text field has focus and the keyboard has shrunk the viewport. The installed app's WebView resizes the page for
 * the keyboard and does not report it through `useKeyboard()`, so the tab bar watches for this itself.
 */
export function useTextEntryKeyboard(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let baseline = { width: window.innerWidth, height: window.innerHeight };
    let editing = focusedFieldTakesText();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const evaluate = () => setOpen(editing && resizedByKeyboard(baseline.height, window.innerHeight));
    const onResize = () => {
      // The page at full height (no keyboard) is the reference; a change of width is a rotation, which has a new reference.
      if (!editing || window.innerWidth !== baseline.width) baseline = { width: window.innerWidth, height: window.innerHeight };
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
  }, []);

  return open;
}
