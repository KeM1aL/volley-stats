/**
 * Virtual Keyboard Detection Types
 *
 * Provides type definitions for keyboard detection across different APIs:
 * - VirtualKeyboard API (Android Chrome 94+)
 * - Visual Viewport API (iOS Safari 13+, Firefox)
 * - Focus/Resize fallback (older browsers)
 */

/**
 * Detection method used for keyboard detection
 */
export type KeyboardDetectionMethod =
  | 'virtualKeyboard'  // VirtualKeyboard API - provides exact geometry
  | 'visualViewport'   // Visual Viewport API - calculates from viewport changes
  | 'focus'            // Focus detection fallback - basic visibility only
  | 'unsupported'      // No detection method available

/**
 * Main keyboard state interface
 */
export interface VirtualKeyboardState {
  /** Keyboard height in pixels (0 if hidden) */
  height: number

  /** Whether the keyboard is currently visible */
  visible: boolean

  /** Full keyboard geometry (only available with VirtualKeyboard API) */
  rect: DOMRect | null

  /** Detection method being used */
  method: KeyboardDetectionMethod
}

/**
 * Callback function type for keyboard state changes
 */
export type KeyboardEventCallback = (state: VirtualKeyboardState) => void

/**
 * Options for keyboard detector configuration
 */
export interface KeyboardDetectorOptions {
  /** Debounce delay in milliseconds for resize events (default: 100) */
  debounceDelay?: number

  /** Minimum height change to consider keyboard visible (default: 100) */
  minHeightChange?: number
}

/**
 * TypeScript declarations for VirtualKeyboard API
 * (These may already exist in lib.dom.d.ts for newer TypeScript versions)
 */
declare global {
  interface Navigator {
    readonly virtualKeyboard?: VirtualKeyboard
  }

  interface VirtualKeyboard extends EventTarget {
    /**
     * Show the virtual keyboard programmatically
     */
    show(): void

    /**
     * Hide the virtual keyboard programmatically
     */
    hide(): void

    /**
     * Current bounding rectangle of the virtual keyboard
     */
    readonly boundingRect: DOMRect

    /**
     * Control whether keyboard overlays content or resizes viewport
     * - false (default): Browser resizes viewport automatically
     * - true: Keyboard overlays content, manual handling required
     */
    overlaysContent: boolean

    /**
     * Event handler for geometry changes
     */
    ongeometrychange: ((this: VirtualKeyboard, ev: Event) => any) | null
  }

  interface VisualViewport extends EventTarget {
    readonly offsetLeft: number
    readonly offsetTop: number
    readonly pageLeft: number
    readonly pageTop: number
    readonly width: number
    readonly height: number
    readonly scale: number

    onresize: ((this: VisualViewport, ev: Event) => any) | null
    onscroll: ((this: VisualViewport, ev: Event) => any) | null
  }
}

export {}
