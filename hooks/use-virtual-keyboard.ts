/**
 * useVirtualKeyboard Hook
 *
 * React hook for detecting virtual keyboard state across platforms.
 * Automatically selects the best available detection method:
 * - VirtualKeyboard API (Android Chrome 94+)
 * - Visual Viewport API (iOS Safari 13+)
 * - Focus/Resize detection (fallback)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { height, visible, method } = useVirtualKeyboard()
 *
 *   return (
 *     <div style={{ paddingBottom: `${height}px` }}>
 *       Keyboard is {visible ? 'visible' : 'hidden'} ({method})
 *     </div>
 *   )
 * }
 * ```
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createKeyboardDetector } from '@/lib/keyboard/keyboard-detector'
import type {
  VirtualKeyboardState,
  KeyboardDetectorOptions,
} from '@/lib/keyboard/types'

/**
 * Initial keyboard state (hidden)
 */
const INITIAL_STATE: VirtualKeyboardState = {
  height: 0,
  visible: false,
  rect: null,
  method: 'unsupported',
}

/**
 * Hook for detecting virtual keyboard state
 *
 * @param options - Configuration options for keyboard detection
 * @returns Current keyboard state
 */
export function useVirtualKeyboard(
  options?: KeyboardDetectorOptions
): VirtualKeyboardState {
  const [keyboardState, setKeyboardState] =
    useState<VirtualKeyboardState>(INITIAL_STATE)

  // Memoize the state update callback
  const handleKeyboardChange = useCallback(
    (state: VirtualKeyboardState) => {
      setKeyboardState(state)
    },
    []
  )

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      return
    }

    // Create keyboard detector with the appropriate strategy
    const cleanup = createKeyboardDetector(handleKeyboardChange, options)

    // Cleanup on unmount
    return cleanup
  }, [handleKeyboardChange, options])

  return keyboardState
}
