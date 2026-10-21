'use client';

import * as React from "react";
import { components, type SelectComponentsConfig } from "react-select";

/**
 * Marks the portal of a react-select menu, so a dialog can tell a click inside a menu from an outside click.
 */
const MENU_PORTAL_ATTRIBUTE = "data-select-menu-portal";

/** True when the event target is inside the menu of a react-select (rendered in a portal on document.body). */
export function isInSelectMenuPortal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${MENU_PORTAL_ATTRIBUTE}]`) !== null;
}

// Above the dialog (z-50). Radix's modal sets pointer-events: none on body, so the portal turns it back on.
// The wheel/touch handlers keep the dialog's scroll lock from swallowing scrolling inside a long menu.
function MenuPortal(props: React.ComponentProps<typeof components.MenuPortal>) {
  return (
    <components.MenuPortal
      {...props}
      innerProps={{
        ...props.innerProps,
        [MENU_PORTAL_ATTRIBUTE]: "",
        style: { zIndex: 100, pointerEvents: "auto" },
        onWheel: (event: React.WheelEvent) => event.stopPropagation(),
        onTouchMove: (event: React.TouchEvent) => event.stopPropagation(),
      } as React.HTMLAttributes<HTMLDivElement>}
    />
  );
}

/**
 * Props for a react-select used inside a dialog: the menu is rendered on document.body (fixed, flipping to the
 * side with room), so the dialog's overflow can't clip it. Spread it on the select: {...selectMenuPortalProps()}.
 */
export function selectMenuPortalProps() {
  return {
    menuPortalTarget: typeof document === "undefined" ? undefined : document.body,
    menuPosition: "fixed" as const,
    menuPlacement: "auto" as const,
    // These selects are all single-value
    components: { MenuPortal } as SelectComponentsConfig<any, false, any>,
  };
}
